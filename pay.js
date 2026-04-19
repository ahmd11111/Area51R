/**
 * Payment Configuration
 * Export API keys and placeholders for payment providers
 */

module.exports = {
  // PayPal Configuration
  paypal: {
    clientId: 'YOUR_PAYPAL_CLIENT_ID',
    clientSecret: 'YOUR_PAYPAL_CLIENT_SECRET',
    mode: 'sandbox', // 'sandbox' or 'live'
    webhookId: 'YOUR_PAYPAL_WEBHOOK_ID'
  },

  // Stripe (MasterCard) Configuration
  stripe: {
    publishableKey: 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY',
    secretKey: 'sk_test_YOUR_STRIPE_SECRET_KEY',
    webhookSecret: 'whsec_YOUR_STRIPE_WEBHOOK_SECRET',
    currency: 'USD'
  },

  // Binance Pay Configuration
  binance: {
    apiKey: 'YOUR_BINANCE_API_KEY',
    apiSecret: 'YOUR_BINANCE_API_SECRET',
    merchantId: 'YOUR_MERCHANT_ID'
  },

  // Apple Pay Configuration
  applePay: {
    merchantId: 'merchant.com.yourstore.x5',
    merchantName: 'X5 Store',
    certificatePath: '/path/to/apple-pay-certificate.p12',
    certificatePassword: 'YOUR_CERTIFICATE_PASSWORD'
  },

  // Discord Webhook for automated delivery
  discord: {
    webhookUrl: 'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID',
    embedColor: 'DC143C' // Red color for embed
  },

  // General Payment Settings
  settings: {
    currency: 'USD',
    currencySymbol: '$',
    taxRate: 0.1, // 10% tax
    freeShippingThreshold: 100, // Free shipping over $100
    shippingCost: 9.99
  }
};