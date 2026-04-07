import { atom, computed } from 'nanostores';
import type { CartItem, Product } from '../types/product';

// Clave para el almacenamiento en el navegador
const STORAGE_KEY = 'midnight_cart_v1';

export interface CustomerData {
  nombre: string;
  cedula: string;
  telefono: string;
  direccion: string;
  metodoEntrega: 'DELIVERY' | 'PICKUP';
  metodoPago: string;
}

// 1. Helper para obtener datos iniciales de forma segura (evita errores de SSR en Astro)
const getInitialCart = (): CartItem[] => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error al parsear el carrito del localStorage", e);
      return [];
    }
  }
  return [];
};

// --- Átomos de estado ---
export const cartItems = atom<CartItem[]>(getInitialCart());
export const isCartOpen = atom<boolean>(false);

export const customerData = atom<CustomerData>({
  nombre: '',
  cedula: '',
  telefono: '',
  direccion: '',
  metodoEntrega: 'PICKUP',
  metodoPago: 'PAGO MÓVIL'
});

// --- Persistencia Automática ---
// Escucha cambios en cartItems y guarda en localStorage automáticamente (solo en el cliente)
if (typeof window !== 'undefined') {
  cartItems.listen((items) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  });
}

// --- Computados ---
export const cartTotal = computed(cartItems, (items) => {
  return items.reduce((total, item) => total + (item.precio * item.cantidad), 0);
});

// --- Acciones del Carrito ---

/**
 * Añade un producto al carrito o incrementa su cantidad si ya existe.
 * Compatible con la página de producto [id].astro
 */
export function addToCart(product: Product | CartItem) {
  const currentItems = cartItems.get();
  const existingItem = currentItems.find(item => item.id === product.id);

  if (existingItem) {
    increaseQuantity(existingItem.id);
  } else {
    // Forzamos que el nuevo item entre con cantidad 1
    const newItem = { ...product, cantidad: 1 } as CartItem;
    cartItems.set([...currentItems, newItem]);
  }
}

export function increaseQuantity(id: string) {
  const newItems = cartItems.get().map(item =>
    item.id === id ? { ...item, cantidad: item.cantidad + 1 } : item
  );
  cartItems.set(newItems);
}

export function decreaseQuantity(id: string) {
  const currentItems = cartItems.get();
  const item = currentItems.find(i => i.id === id);
  
  if (item && item.cantidad > 1) {
    const newItems = currentItems.map(i =>
      i.id === id ? { ...i, cantidad: i.cantidad - 1 } : i
    );
    cartItems.set(newItems);
  } else {
    removeFromCart(id);
  }
}

export function removeFromCart(id: string) {
  cartItems.set(cartItems.get().filter(item => item.id !== id));
}

export function clearCart() {
  cartItems.set([]);
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// --- Lógica de Pedido por WhatsApp ---
export function sendOrderToWhatsApp() {
  const items = cartItems.get();
  const data = customerData.get();
  const total = cartTotal.get();
  
  // Asegúrate de definir PUBLIC_WHATSAPP_NUMBER en tu archivo .env
  const phone = import.meta.env.PUBLIC_WHATSAPP_NUMBER || "TU_NUMERO_AQUI";
  
  if (items.length === 0) return;

  let message = `*📦 PEDIDO - MIDNIGHT STUDIO*\n`;
  message += `--------------------------------\n`;
  message += `👤 *CLIENTE:* ${data.nombre.toUpperCase()}\n`;
  message += `🆔 *CÉDULA:* ${data.cedula}\n`;
  message += `📞 *TELÉFONO:* ${data.telefono}\n`;
  message += `📍 *ENTREGA:* ${data.metodoEntrega}\n`;
  
  if (data.metodoEntrega === 'DELIVERY') {
    message += `🏠 *DIRECCIÓN:* ${data.direccion.toUpperCase()}\n`;
  }
  
  message += `💳 *PAGO:* ${data.metodoPago}\n`;
  message += `--------------------------------\n`;
  message += `*DETALLE DEL PEDIDO:*\n`;

  items.forEach(item => {
    message += `- ${item.cantidad}x ${item.nombre} ($${(item.precio * item.cantidad).toFixed(2)})\n`;
  });

  message += `--------------------------------\n`;
  message += `*TOTAL FINAL: $${total.toFixed(2)}*`;

  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
}