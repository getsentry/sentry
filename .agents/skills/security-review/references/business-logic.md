# Business Logic Security Reference

## Overview

Business logic vulnerabilities occur when the application's logic can be manipulated to achieve unintended outcomes. Unlike technical vulnerabilities, these flaws exploit legitimate functionality in unexpected ways.

## Common Vulnerability Types

### 1. Race Conditions

#### Time-of-Check to Time-of-Use (TOCTOU)

```python
# VULNERABLE: Race condition in balance check
def transfer(from_account, to_account, amount):
    if from_account.balance >= amount:  # Check
        time.sleep(0.1)  # Simulating processing delay
        from_account.balance -= amount   # Use
        to_account.balance += amount

# Attack: Two concurrent transfers can overdraft

# SAFE: Atomic operation with locking
from threading import Lock

account_locks = {}

def transfer(from_account, to_account, amount):
    # Acquire locks in consistent order to prevent deadlock
    locks = sorted([from_account.id, to_account.id])
    with account_locks[locks[0]], account_locks[locks[1]]:
        if from_account.balance >= amount:
            from_account.balance -= amount
            to_account.balance += amount
            return True
    return False
```

#### Database-Level Locking

```python
# SAFE: Database transaction with SELECT FOR UPDATE
from django.db import transaction

@transaction.atomic
def transfer(from_account_id, to_account_id, amount):
    from_account = Account.objects.select_for_update().get(id=from_account_id)
    to_account = Account.objects.select_for_update().get(id=to_account_id)

    if from_account.balance >= amount:
        from_account.balance -= amount
        to_account.balance += amount
        from_account.save()
        to_account.save()
        return True
    return False
```

### 2. Workflow Bypass

```python
# VULNERABLE: Multi-step process without server-side tracking
# Step 1: /verify-email
# Step 2: /set-password
# Step 3: /complete-registration

# Attacker skips to Step 3

# SAFE: Server-side state machine
class RegistrationFlow:
    STATES = ['email_pending', 'email_verified', 'password_set', 'complete']

    def __init__(self, user_id):
        self.state = self.get_state(user_id)

    def verify_email(self, token):
        if self.state != 'email_pending':
            raise InvalidStateError("Email verification not pending")
        # Verify token...
        self.set_state('email_verified')

    def set_password(self, password):
        if self.state != 'email_verified':
            raise InvalidStateError("Email not verified")
        # Set password...
        self.set_state('password_set')

    def complete(self):
        if self.state != 'password_set':
            raise InvalidStateError("Password not set")
        # Complete registration...
        self.set_state('complete')
```

### 3. Numeric Manipulation

#### Integer Overflow

```python
# VULNERABLE: Integer overflow in quantity
def calculate_total(quantity, price):
    return quantity * price

# Attack: quantity = -1 results in negative price (refund)

# SAFE: Validate numeric ranges
def calculate_total(quantity, price):
    if quantity <= 0 or quantity > MAX_QUANTITY:
        raise ValueError("Invalid quantity")
    if price <= 0:
        raise ValueError("Invalid price")
    return quantity * price
```

#### Floating Point Issues

```python
# VULNERABLE: Floating point precision loss
total = 0.0
for item in items:
    total += item.price * item.quantity

# 0.1 + 0.2 = 0.30000000000000004

# SAFE: Use Decimal for financial calculations
from decimal import Decimal, ROUND_HALF_UP

total = Decimal('0')
for item in items:
    total += Decimal(str(item.price)) * item.quantity

# Round properly
total = total.quantize(Decimal('.01'), rounding=ROUND_HALF_UP)
```

### 4. Price/Discount Manipulation

```python
# VULNERABLE: Trust client-submitted price
@app.route('/checkout', methods=['POST'])
def checkout():
    price = request.json['price']  # Client can set any price!
    process_payment(price)

# SAFE: Calculate price server-side
@app.route('/checkout', methods=['POST'])
def checkout():
    cart = get_cart(current_user.id)
    price = calculate_total(cart)  # Always server-calculated
    process_payment(price)
```

```python
# VULNERABLE: Stackable discounts without limits
def apply_discounts(cart, discount_codes):
    for code in discount_codes:
        discount = get_discount(code)
        cart.total -= discount.amount

# Attack: Apply same code multiple times, negative total

# SAFE: Limit discount application
def apply_discounts(cart, discount_codes):
    # Remove duplicates
    unique_codes = set(discount_codes)

    total_discount = Decimal('0')
    for code in unique_codes:
        if is_code_used(cart.user_id, code):
            continue  # Code already used
        discount = get_discount(code)
        total_discount += discount.amount
        mark_code_used(cart.user_id, code)

    # Cap discount at total
    max_discount = cart.subtotal * Decimal('0.5')  # Max 50% off
    final_discount = min(total_discount, max_discount)
    cart.total -= final_discount
```

### 5. Inventory/Resource Exhaustion

```python
# VULNERABLE: No reservation during checkout
def checkout(cart):
    for item in cart.items:
        if get_stock(item.product_id) >= item.quantity:
            # Stock available
            pass
    # Processing takes time...
    process_payment()
    for item in cart.items:
        reduce_stock(item.product_id, item.quantity)  # May oversell

# SAFE: Reserve inventory atomically
@transaction.atomic
def checkout(cart):
    for item in cart.items:
        product = Product.objects.select_for_update().get(id=item.product_id)
        if product.stock < item.quantity:
            raise InsufficientStock(product.name)
        product.stock -= item.quantity  # Reserve immediately
        product.save()

    # If payment fails, transaction rolls back
    process_payment()
```

### 6. Time-Based Attacks

```python
# VULNERABLE: Expired coupon still usable with timing attack
def apply_coupon(code):
    coupon = Coupon.objects.get(code=code)
    if coupon.expiry > datetime.now():
        return coupon.discount
    raise CouponExpired()

# SAFE: Use database time, not application time
from django.db.models.functions import Now

def apply_coupon(code):
    coupon = Coupon.objects.annotate(
        is_valid=Q(expiry__gt=Now())
    ).get(code=code)

    if not coupon.is_valid:
        raise CouponExpired()
    return coupon.discount
```

### 7. Parameter Tampering

```python
# VULNERABLE: Trust hidden form fields
# HTML: <input type="hidden" name="user_id" value="123">

@app.route('/update-profile', methods=['POST'])
def update_profile():
    user_id = request.form['user_id']  # Attacker can change this!
    User.query.get(user_id).update(...)

# SAFE: Use session-based user identification
@app.route('/update-profile', methods=['POST'])
def update_profile():
    user_id = current_user.id  # From authenticated session
    User.query.get(user_id).update(...)
```

---

## Detection Patterns

### State Machine Validation

```python
class OrderStateMachine:
    VALID_TRANSITIONS = {
        'draft': ['submitted'],
        'submitted': ['approved', 'rejected'],
        'approved': ['shipped'],
        'shipped': ['delivered', 'returned'],
        'delivered': ['returned'],
        'rejected': [],
        'returned': ['refunded'],
        'refunded': []
    }

    def transition(self, order, new_state):
        current = order.state
        if new_state not in self.VALID_TRANSITIONS.get(current, []):
            raise InvalidTransition(f"Cannot go from {current} to {new_state}")
        order.state = new_state
        log_state_change(order, current, new_state)
```

### Idempotency

```python
# SAFE: Idempotent operations with idempotency keys
import hashlib

def process_request(request_data, idempotency_key):
    # Check if request was already processed
    existing = ProcessedRequest.query.filter_by(key=idempotency_key).first()
    if existing:
        return existing.response  # Return cached response

    # Process request
    result = do_processing(request_data)

    # Store for future duplicate requests
    ProcessedRequest.create(key=idempotency_key, response=result)
    return result
```

### Rate Limiting Business Actions

```python
# Limit business-critical actions
from functools import wraps
import time

def rate_limit_action(action_name, limit, window):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            user_id = current_user.id
            key = f"action:{action_name}:{user_id}"

            count = redis.incr(key)
            if count == 1:
                redis.expire(key, window)

            if count > limit:
                raise RateLimitExceeded(f"Too many {action_name} attempts")

            return f(*args, **kwargs)
        return wrapper
    return decorator

@rate_limit_action('password_reset', limit=3, window=3600)
def request_password_reset(email):
    pass

@rate_limit_action('transfer', limit=10, window=86400)
def transfer_funds(from_account, to_account, amount):
    pass
```

---

## Validation Patterns

### Server-Side Calculation

```python
# Always recalculate on server
def calculate_order_total(order):
    subtotal = Decimal('0')
    for item in order.items:
        # Get current price from database, not from request
        product = Product.query.get(item.product_id)
        subtotal += product.price * item.quantity

    # Apply tax
    tax = subtotal * get_tax_rate(order.shipping_address)

    # Apply discounts (validated server-side)
    discount = calculate_discounts(order, order.discount_codes)

    # Calculate total
    total = subtotal + tax - discount

    # Sanity checks
    if total < Decimal('0'):
        raise InvalidOrderError("Negative total")
    if discount > subtotal:
        raise InvalidOrderError("Discount exceeds subtotal")

    return {
        'subtotal': subtotal,
        'tax': tax,
        'discount': discount,
        'total': total
    }
```

### Business Rule Enforcement

```python
class TransferValidator:
    def validate(self, transfer):
        errors = []

        # Check transfer limits
        if transfer.amount > MAX_SINGLE_TRANSFER:
            errors.append("Exceeds single transfer limit")

        # Check daily limits
        daily_total = get_daily_transfer_total(transfer.from_account)
        if daily_total + transfer.amount > DAILY_LIMIT:
            errors.append("Exceeds daily transfer limit")

        # Check velocity (unusual number of transfers)
        recent_count = get_recent_transfer_count(transfer.from_account, hours=1)
        if recent_count > MAX_TRANSFERS_PER_HOUR:
            errors.append("Too many transfers in short period")

        # Check for unusual patterns
        if is_unusual_recipient(transfer.from_account, transfer.to_account):
            errors.append("Unusual recipient - requires verification")

        if errors:
            raise ValidationError(errors)
```

---

## Grep Patterns for Detection

```bash
# Race condition indicators
grep -rn "sleep\|time\.sleep\|Thread\|async" --include="*.py"
grep -rn "balance\|inventory\|stock" --include="*.py" | grep -v "select_for_update\|lock"

# Price/amount from request
grep -rn "request\.\w*\[.*price\|request\.\w*\[.*amount\|request\.\w*\[.*total" --include="*.py"

# Missing validation
grep -rn "def checkout\|def purchase\|def transfer" --include="*.py"

# Floating point for money
grep -rn "float.*price\|float.*amount\|float.*balance" --include="*.py"
```

---

## Testing Checklist

- [ ] Race conditions tested (concurrent requests)
- [ ] Workflow steps enforced server-side
- [ ] State transitions validated
- [ ] Prices/totals calculated server-side
- [ ] Discount limits enforced
- [ ] Inventory checked and reserved atomically
- [ ] Integer overflow/underflow prevented
- [ ] Decimal used for financial calculations
- [ ] Time-based logic uses server/database time
- [ ] Hidden field values not trusted
- [ ] Idempotency keys for critical operations
- [ ] Rate limits on business-critical actions
- [ ] Unusual patterns detected and flagged

---

## References

- [OWASP Business Logic Testing](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/)
- [CWE-362: Race Condition](https://cwe.mitre.org/data/definitions/362.html)
- [CWE-367: TOCTOU Race Condition](https://cwe.mitre.org/data/definitions/367.html)
- [CWE-190: Integer Overflow](https://cwe.mitre.org/data/definitions/190.html)
- [CWE-840: Business Logic Errors](https://cwe.mitre.org/data/definitions/840.html)
