import { Routes } from '@angular/router';
import { CreateOrderComponent } from './create-order/create-order.component';
import { OrderlistComponent } from './orderlist/orderlist.component';

export const routes: Routes = [
  { path: 'crear-orden', component: CreateOrderComponent },
  { path: 'ver-orden', component: OrderlistComponent },
  { path: '', redirectTo: '/crear-orden', pathMatch: 'full' }
];

