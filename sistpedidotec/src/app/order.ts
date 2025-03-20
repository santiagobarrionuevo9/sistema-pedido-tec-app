import { Product } from "./product";

export interface Order {
    id?: string;
    customerName: string;
    email: string;
    products: OrderProduct[];
    total: number;
    orderCode: string;
    timestamp: string;
}

export interface OrderProduct {
    productId: string;
    quantity: number;
    stock: number;
    price: number;
  }

