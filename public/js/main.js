// X5 Store - Main JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Mobile Menu Toggle
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');
  
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', function() {
      navLinks.classList.toggle('active');
      const icon = this.querySelector('i');
      if (navLinks.classList.contains('active')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
      } else {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
      }
    });
  }
  
  // Close mobile menu when clicking outside
  document.addEventListener('click', function(e) {
    if (navLinks && !navLinks.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
      navLinks.classList.remove('active');
      const icon = mobileMenuBtn.querySelector('i');
      icon.classList.remove('fa-times');
      icon.classList.add('fa-bars');
    }
  });
  
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
  
  // Add to cart animation
  const addToCartForms = document.querySelectorAll('.add-to-cart-form');
  addToCartForms.forEach(form => {
    form.addEventListener('submit', function(e) {
      const btn = this.querySelector('button');
      if (btn) {
        btn.innerHTML = '<i class="fas fa-check"></i> Added!';
        btn.style.background = '#28a745';
        setTimeout(() => {
          btn.innerHTML = '<i class="fas fa-cart-plus"></i> Add to Cart';
          btn.style.background = '';
        }, 2000);
      }
    });
  });
  
  // Image error handling
  const productImages = document.querySelectorAll('.product-image img, .cart-item-image img, .table-image');
  productImages.forEach(img => {
    img.addEventListener('error', function() {
      this.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';
    });
  });
  
  // Navbar scroll effect
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 50) {
        navbar.style.boxShadow = '0 4px 30px rgba(139, 0, 0, 0.5)';
      } else {
        navbar.style.boxShadow = '';
      }
    });
  }
  
  // Quantity controls (if needed for future enhancement)
  const quantityBtns = document.querySelectorAll('.qty-btn');
  quantityBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const input = this.parentElement.querySelector('input');
      let value = parseInt(input.value);
      if (this.classList.contains('plus')) {
        value++;
      } else if (this.classList.contains('minus') && value > 1) {
        value--;
      }
      input.value = value;
    });
  });
  
  // Form validation feedback
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      const inputs = this.querySelectorAll('input[required]');
      let valid = true;
      inputs.forEach(input => {
        if (!input.value.trim()) {
          valid = false;
          input.style.borderColor = '#DC143C';
        } else {
          input.style.borderColor = '';
        }
      });
      if (!valid) {
        e.preventDefault();
        alert('Please fill in all required fields');
      }
    });
  });
  
  // Floating cart button animation
  const floatingCart = document.querySelector('.floating-cart');
  if (floatingCart) {
    floatingCart.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.1) rotate(5deg)';
    });
    floatingCart.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1) rotate(0)';
    });
  }
  
  // Console message
  console.log('%c X5 Store ', 'background: #8B0000; color: white; font-size: 20px; padding: 10px;');
  console.log('%c Welcome to X5 Store! ', 'color: #DC143C; font-size: 14px;');
});