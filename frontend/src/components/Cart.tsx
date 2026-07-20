import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';

const SHIPPING_FREE_THRESHOLD = 100;
const SHIPPING_COST = 25;

export default function Cart() {
  const { darkMode } = useTheme();
  const { items, removeItem, updateQuantity, subtotal } = useCart();
  const [quantities, setQuantities] = useState<Record<number, number>>(
    Object.fromEntries(items.map((i) => [i.productId, i.quantity])),
  );

  const shipping = subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_COST;
  const grandTotal = subtotal + shipping;

  const handleQuantityChange = (productId: number, value: number) => {
    const clamped = Math.max(1, value);
    setQuantities((prev) => ({ ...prev, [productId]: clamped }));
  };

  const handleUpdateCart = () => {
    items.forEach((item) => {
      const qty = quantities[item.productId];
      if (qty !== undefined) {
        updateQuantity(item.productId, qty);
      }
    });
  };

  const handleRemove = (productId: number) => {
    removeItem(productId);
    setQuantities((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const containerClass = `min-h-screen ${darkMode ? 'bg-dark' : 'bg-gray-100'} pt-20 pb-16 px-4 transition-colors duration-300`;
  const cardClass = `${darkMode ? 'bg-gray-800 text-light' : 'bg-white text-gray-800'} rounded-lg shadow-lg transition-colors duration-300`;
  const thClass = `px-4 py-3 text-left text-sm font-semibold ${darkMode ? 'text-light' : 'text-gray-700'} border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`;
  const tdClass = `px-4 py-4 ${darkMode ? 'border-gray-700' : 'border-gray-200'} border-b`;

  if (items.length === 0) {
    return (
      <div className={containerClass}>
        <div className="max-w-4xl mx-auto">
          <h1 className={`text-3xl font-bold mb-8 ${darkMode ? 'text-light' : 'text-gray-800'}`}>
            Your Cart
          </h1>
          <div className={`${cardClass} p-12 text-center`}>
            <svg
              className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className={`text-xl font-medium mb-4 ${darkMode ? 'text-light' : 'text-gray-700'}`}>
              Your cart is empty
            </p>
            <Link
              to="/products"
              className="inline-block bg-primary hover:bg-accent text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Browse Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className="max-w-7xl mx-auto">
        <h1 className={`text-3xl font-bold mb-8 ${darkMode ? 'text-light' : 'text-gray-800'}`}>
          Your Cart
        </h1>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Cart Items Table */}
          <div className="flex-1">
            <div className={cardClass}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={thClass}>S. No.</th>
                      <th className={thClass}>Product Image</th>
                      <th className={thClass}>Product Name</th>
                      <th className={thClass}>Unit Price</th>
                      <th className={thClass}>Quantity</th>
                      <th className={thClass}>Total</th>
                      <th className={thClass}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const effectivePrice = item.discount
                        ? item.price * (1 - item.discount)
                        : item.price;
                      const qty = quantities[item.productId] ?? item.quantity;
                      const lineTotal = effectivePrice * qty;

                      return (
                        <tr key={item.productId}>
                          <td className={`${tdClass} text-center font-medium`}>{index + 1}</td>
                          <td className={tdClass}>
                            <div
                              className={`w-16 h-16 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} flex items-center justify-center`}
                            >
                              <img
                                src={`/${item.imgName}`}
                                alt={item.name}
                                className="w-full h-full object-contain p-1"
                              />
                            </div>
                          </td>
                          <td className={`${tdClass} font-semibold`}>{item.name}</td>
                          <td className={tdClass}>${effectivePrice.toFixed(2)}</td>
                          <td className={tdClass}>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleQuantityChange(item.productId, qty - 1)}
                                className={`w-7 h-7 flex items-center justify-center rounded ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-light' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} transition-colors`}
                                aria-label={`Decrease quantity of ${item.name}`}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={qty}
                                onChange={(e) =>
                                  handleQuantityChange(item.productId, parseInt(e.target.value) || 1)
                                }
                                className={`w-12 text-center rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-light' : 'bg-white border-gray-300 text-gray-800'} py-1 focus:outline-none focus:border-primary`}
                                aria-label={`Quantity of ${item.name}`}
                              />
                              <button
                                onClick={() => handleQuantityChange(item.productId, qty + 1)}
                                className={`w-7 h-7 flex items-center justify-center rounded ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-light' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} transition-colors`}
                                aria-label={`Increase quantity of ${item.name}`}
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className={`${tdClass} font-semibold text-primary`}>
                            ${lineTotal.toFixed(2)}
                          </td>
                          <td className={tdClass}>
                            <button
                              onClick={() => handleRemove(item.productId)}
                              className="text-red-500 hover:text-red-700 transition-colors"
                              aria-label={`Remove ${item.name} from cart`}
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom actions */}
              <div className="flex items-center justify-end p-4 gap-4">
                <button
                  onClick={handleUpdateCart}
                  className="bg-primary hover:bg-accent text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Update Cart
                </button>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:w-72 flex-shrink-0">
            <div className={cardClass}>
              <div
                className={`px-6 py-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
              >
                <h2 className="text-xl font-bold text-center">Order Summary</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between">
                  <span className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Subtotal
                  </span>
                  <span className="font-semibold">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Shipping
                  </span>
                  <span className="font-semibold">
                    {shipping === 0 ? (
                      <span className="text-primary">Free</span>
                    ) : (
                      `$${shipping.toFixed(2)}`
                    )}
                  </span>
                </div>
                {shipping > 0 && (
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Free shipping on orders over ${SHIPPING_FREE_THRESHOLD}
                  </p>
                )}
                <div
                  className={`flex justify-between pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} font-bold text-lg`}
                >
                  <span>Grand Total</span>
                  <span className="text-primary">${grandTotal.toFixed(2)}</span>
                </div>
                <button className="w-full bg-primary hover:bg-accent text-white py-3 rounded-lg font-medium transition-colors mt-2">
                  Proceed To Checkout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
