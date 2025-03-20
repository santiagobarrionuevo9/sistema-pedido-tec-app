import { Component, inject, OnInit } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, FormArray, FormBuilder, FormControl, FormGroup, FormsModule, NgModel, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Product } from '../product';
import { ApiServiceService } from '../api-service.service';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { debounceTime, map, Observable, of, switchMap } from 'rxjs';


@Component({
  selector: 'app-create-order',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule],
  templateUrl: './create-order.component.html',
  styleUrl: './create-order.component.css'
})
export class CreateOrderComponent implements OnInit {
  orderForm: FormGroup = new FormGroup({});
  products: Product[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private productService: ApiServiceService
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    this.loadProducts();
  }

  private createForm(): void {
    this.orderForm = this.fb.group({
      customerName: ['', [
        Validators.required, 
        Validators.minLength(3),
        (control: AbstractControl): ValidationErrors | null => {
          const hasNumbers = /\d/.test(control.value);
          return hasNumbers ? { containsNumbers: true } : null;
        }
      ]],
      email: ['', 
        [
          Validators.required, 
          Validators.email,
          (control: AbstractControl): ValidationErrors | null => {
            if (!control.value) return null;
            const validDomains = ['gmail.com', 'hotmail.com', 'yahoo.com'];
            const domain = control.value.split('@')[1];
            return domain && validDomains.includes(domain) ? null : { invalidDomain: true };
          }
        ],
        [this.emailOrderValidator()]
      ],
      products: this.fb.array([], [
        Validators.required,
        this.noDuplicateProductsValidator(),
        this.maxTotalQuantityValidator()
      ])
    });
  }

  private noDuplicateProductsValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const products = control.value;
      if (!Array.isArray(products)) return null;

      const productIds = products.map(p => p.productId);
      const uniqueIds = new Set(productIds);

      if (productIds.length !== uniqueIds.size) {
        return { duplicateProducts: true };
      }

      return null;
    };
  }

  private maxTotalQuantityValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const products = control.value;
      if (!Array.isArray(products)) return null;

      const totalQuantity = products.reduce((sum, product) => 
        sum + (parseInt(product.quantity) || 0), 0);

      if (totalQuantity > 10) {
        return { maxTotalQuantity: true };
      }

      return null;
    };
  }

  private emailOrderValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) {
        return of(null);
      }

      return of(control.value).pipe(
        debounceTime(300),
        switchMap(email => 
          this.productService.getOrdersByEmail(email).pipe(
            map(orders => {
              const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
              const recentOrders = orders.filter(order => 
                new Date(order.timestamp) > last24Hours
              );
              return recentOrders.length >= 3 ? { tooManyOrders: true } : null;
            })
          )
        )
      );
    };
  }

  private stockValidator(product: Product) {
    return (control: AbstractControl): ValidationErrors | null => {
      const quantity = control.value;
      if (!quantity || !product) return null;

      if (quantity > product.stock) {
        return { insufficientStock: true };
      }

      return null;
    };
  }

  get productsFormArray(): FormArray {
    return this.orderForm.get('products') as FormArray;
  }

  private loadProducts(): void {
    this.loading = true;
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Error loading products';
        this.loading = false;
      }
    });
  }

  addProduct(): void {
    const productForm = this.fb.group({
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      stock: [{ value: 0, disabled: true }],
      price: [{ value: 0, disabled: true }]
    });

    // Suscribirse a los cambios en productId
    productForm.get('productId')?.valueChanges.subscribe(productId => {
      const selectedProduct = this.products.find(p => p.id === productId);
      if (selectedProduct) {
        // Actualizar los valores de stock y precio
        productForm.patchValue({
          stock: selectedProduct.stock,
          price: selectedProduct.price
        }, { emitEvent: false });

        // Actualizar validadores de cantidad
        const quantityControl = productForm.get('quantity');
        if (quantityControl) {
          quantityControl.setValidators([
            Validators.required,
            Validators.min(1),
            this.stockValidator(selectedProduct)
          ]);
          quantityControl.updateValueAndValidity();
        }
      }
    });

    this.productsFormArray.push(productForm);
  }

  removeProduct(index: number): void {
    this.productsFormArray.removeAt(index);
  }

  calculateTotal(): number {
    let total = 0;
    
    this.productsFormArray.controls.forEach(control => {
      const quantity = control.get('quantity')?.value || 0;
      const price = control.get('price')?.value || 0;
      total += quantity * price;
    });

    // Aplicar descuento si el total es mayor a 1000
    return total > 1000 ? total * 0.9 : total;
  }

  generateOrderCode(name: string, email: string): string {
    const firstLetter = name.charAt(0).toUpperCase();
    const emailSuffix = email.slice(-4);
    const timestamp = Date.now();
    return `${firstLetter}${emailSuffix}${timestamp}`;
  }

  onSubmit(): void {
    if (this.orderForm.valid) {
      const formValue = this.orderForm.value;
      
      // Mapear los productos para incluir precio y stock
      const products = this.productsFormArray.controls.map(control => ({
        productId: control.get('productId')?.value,
        quantity: control.get('quantity')?.value,
        stock: control.get('stock')?.value,
        price: control.get('price')?.value
      }));

      const order = {
        customerName: formValue.customerName,
        email: formValue.email,
        products: products,
        total: this.calculateTotal(),
        orderCode: this.generateOrderCode(formValue.customerName, formValue.email),
        timestamp: new Date().toISOString()
      };

      this.loading = true;
      this.productService.createOrder(order).subscribe({
        next: () => {
          this.orderForm.reset();
          this.productsFormArray.clear();
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Error creating order';
          this.loading = false;
        }
      });
    } else {
      this.markFormGroupTouched(this.orderForm);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup | FormArray) {
    Object.values(formGroup.controls).forEach(control => {
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      } else {
        control.markAsTouched();
      }
    });
  }

  getErrorMessage(controlName: string): string {
    const control = this.orderForm.get(controlName);
    if (!control || !control.errors) return '';

    const errors = control.errors;
    if (errors['required']) return 'This field is required';
    if (errors['email']) return 'Invalid email format';
    if (errors['minlength']) return `Minimum length is ${errors['minlength'].requiredLength}`;
    if (errors['containsNumbers']) return 'Name should not contain numbers';
    if (errors['invalidDomain']) return 'Invalid email domain';
    if (errors['tooManyOrders']) return 'Too many orders in the last 24 hours';
    if (errors['insufficientStock']) return 'Insufficient stock';
    if (errors['duplicateProducts']) return 'Duplicate products are not allowed';
    if (errors['maxTotalQuantity']) return 'Maximum total quantity exceeded';

    return 'Invalid input';
  }
}