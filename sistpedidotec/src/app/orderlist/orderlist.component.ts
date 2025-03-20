import { Component, OnInit } from '@angular/core';
import { Order } from '../order';
import { ApiServiceService } from '../api-service.service';
import { FormsModule, NgModelGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-orderlist',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orderlist.component.html',
  styleUrl: './orderlist.component.css'
})
export class OrderlistComponent implements OnInit {
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  searchTerm: string = '';
  loading: boolean = false;
  error: string | null = null;

  constructor(private productService: ApiServiceService) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  private loadOrders(): void {
    this.loading = true;
    this.productService.getOrders().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.filteredOrders = orders;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Error loading orders';
        this.loading = false;
        console.error('Error loading orders:', error);
      }
    });
  }

  filterOrders(): void {
    if (!this.searchTerm.trim()) {
      this.filteredOrders = this.orders;
      return;
    }

    const searchTermLower = this.searchTerm.toLowerCase().trim();
    this.filteredOrders = this.orders.filter(order => 
      order.customerName.toLowerCase().includes(searchTermLower) ||
      order.email.toLowerCase().includes(searchTermLower)
    );
  }

  // Método helper para formatear la fecha a un string legible
  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }

  // Método para refrescar la lista de órdenes
  refreshOrders(): void {
    this.loadOrders();
  }

  // Método para calcular el total de productos en una orden
  getProductCount(order: Order): number {
    return order.products.reduce((total, product) => total + product.quantity, 0);
  }

  // Método para ordenar la lista por fecha (más reciente primero)
  sortByDate(): void {
    this.filteredOrders.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // Método para ordenar la lista por total (mayor a menor)
  sortByTotal(): void {
    this.filteredOrders.sort((a, b) => b.total - a.total);
  }

  // Método para limpiar el filtro
  clearFilter(): void {
    this.searchTerm = '';
    this.filterOrders();
  }
}
