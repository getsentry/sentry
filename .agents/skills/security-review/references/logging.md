# Security Logging Reference

## Overview

Insufficient logging and monitoring failures allow attacks to go undetected. This includes missing audit trails, sensitive data in logs, log injection attacks, and inadequate alerting on security events.

---

## Missing Security Event Logging

### Events That Must Be Logged

```python
# VULNERABLE: No logging of security events
def login(username, password):
    user = authenticate(username, password)
    if user:
        return create_session(user)
    return None  # Failed login not logged

def change_password(user, old_pass, new_pass):
    if verify_password(old_pass, user.password):
        user.password = hash_password(new_pass)
        user.save()  # Password change not logged
```

### Required Security Events

```python
import logging
from datetime import datetime

security_logger = logging.getLogger('security')

# Authentication events
def login(username, password):
    user = authenticate(username, password)
    if user:
        security_logger.info(
            "login_success",
            extra={
                'user_id': user.id,
                'username': username,
                'ip': request.remote_addr,
                'user_agent': request.user_agent.string,
                'timestamp': datetime.utcnow().isoformat()
            }
        )
        return create_session(user)
    else:
        security_logger.warning(
            "login_failure",
            extra={
                'username': username,
                'ip': request.remote_addr,
                'reason': 'invalid_credentials',
                'timestamp': datetime.utcnow().isoformat()
            }
        )
        return None

# Access control events
def access_resource(user, resource):
    if not user.can_access(resource):
        security_logger.warning(
            "access_denied",
            extra={
                'user_id': user.id,
                'resource': resource.id,
                'action': 'read',
                'ip': request.remote_addr
            }
        )
        raise PermissionDenied()

# Critical data changes
def update_user_role(admin, user, new_role):
    old_role = user.role
    user.role = new_role
    user.save()
    security_logger.info(
        "role_change",
        extra={
            'admin_id': admin.id,
            'target_user_id': user.id,
            'old_role': old_role,
            'new_role': new_role
        }
    )
```

### Security Events Checklist

| Event Type | Must Log |
|------------|----------|
| Login success/failure | User, IP, timestamp, method |
| Logout | User, session duration |
| Password change | User, IP, timestamp |
| Password reset request | Email/user, IP |
| Account lockout | User, reason, duration |
| MFA enrollment/removal | User, method |
| Permission changes | Admin, target, old/new |
| Access denied | User, resource, action |
| Data export | User, data type, volume |
| Admin actions | Admin, action, target |
| API key creation/revocation | User, key ID (not key) |
| Security setting changes | User, setting, old/new |

---

## Sensitive Data in Logs

### Dangerous Patterns

```python
# VULNERABLE: Logging passwords
logger.info(f"User {username} login attempt with password {password}")
logger.debug(f"Auth request: {request.json}")  # Contains password

# VULNERABLE: Logging tokens/secrets
logger.info(f"API request with key: {api_key}")
logger.debug(f"JWT token: {token}")
logger.info(f"Session: {session_cookie}")

# VULNERABLE: Logging PII
logger.info(f"Processing payment for SSN: {ssn}")
logger.debug(f"User data: {user.__dict__}")  # May contain sensitive fields

# VULNERABLE: Logging credit card numbers
logger.info(f"Payment with card: {card_number}")
```

### Secure Logging

```python
# SAFE: Never log credentials
logger.info(f"Login attempt for user: {username}")  # No password

# SAFE: Mask sensitive data
def mask_token(token):
    if len(token) > 8:
        return token[:4] + '****' + token[-4:]
    return '****'

logger.info(f"API request with key: {mask_token(api_key)}")

# SAFE: Redact PII
def redact_pii(data):
    sensitive_fields = {'password', 'ssn', 'credit_card', 'api_key', 'token'}
    if isinstance(data, dict):
        return {k: '[REDACTED]' if k in sensitive_fields else v
                for k, v in data.items()}
    return data

logger.debug(f"Request data: {redact_pii(request.json)}")

# SAFE: Use structured logging with explicit fields
logger.info(
    "payment_processed",
    extra={
        'user_id': user.id,
        'amount': amount,
        'card_last_four': card_number[-4:],  # Only last 4
        'transaction_id': txn_id
    }
)
```

---

## Log Injection

### Attack Vector

Attackers inject malicious content into logs to:
- Forge log entries
- Exploit log viewers (XSS in log dashboards)
- Manipulate log analysis tools
- Hide malicious activity

### Vulnerable Patterns

```python
# VULNERABLE: Unsanitized user input in logs
logger.info(f"User search: {user_input}")
# Attack: user_input = "search\n2024-01-01 INFO admin logged in successfully"

# VULNERABLE: Direct interpolation
logger.info("Search query: " + query)
# Attack: query contains newlines and fake log entries

# VULNERABLE: Format string injection
logger.info("User %s performed action" % user_input)
```

### Secure Logging

```python
# SAFE: Sanitize input before logging
import re

def sanitize_log_input(value):
    """Remove newlines and control characters."""
    if isinstance(value, str):
        # Remove newlines and carriage returns
        value = value.replace('\n', '\\n').replace('\r', '\\r')
        # Remove other control characters
        value = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', value)
    return value

logger.info(f"User search: {sanitize_log_input(user_input)}")

# SAFE: Use structured logging (JSON)
import json_logging
json_logging.init_non_web()

logger.info("search_performed", extra={
    'query': user_input,  # JSON encoding handles special chars
    'user_id': user.id
})

# SAFE: Use parameterized logging
logger.info("User %s searched for %s", user_id, sanitize_log_input(query))
```

---

## Log Storage Security

### Insecure Patterns

```python
# VULNERABLE: World-readable log files
logging.basicConfig(filename='/var/log/app.log')
os.chmod('/var/log/app.log', 0o644)  # Anyone can read

# VULNERABLE: Logs in web-accessible directory
logging.basicConfig(filename='/var/www/html/logs/app.log')

# VULNERABLE: No log rotation (can fill disk)
logging.basicConfig(filename='app.log')  # Grows forever
```

### Secure Log Configuration

```python
# SAFE: Restricted permissions
import os
from logging.handlers import RotatingFileHandler

log_file = '/var/log/app/security.log'
handler = RotatingFileHandler(
    log_file,
    maxBytes=10*1024*1024,  # 10MB
    backupCount=10
)

# Set restrictive permissions
os.chmod(log_file, 0o600)  # Owner only

# SAFE: Centralized logging with encryption
import logging.handlers

syslog_handler = logging.handlers.SysLogHandler(
    address=('secure-syslog.company.com', 514),
    socktype=socket.SOCK_STREAM  # TCP for reliability
)
# Use TLS for syslog transport
```

---

## Missing Alerting

### Security Events Requiring Alerts

```python
# These should trigger immediate alerts, not just logging

ALERT_THRESHOLDS = {
    'failed_logins': 5,        # Per user per hour
    'access_denied': 10,       # Per user per hour
    'admin_login': 1,          # Any admin login from new IP
    'privilege_escalation': 1, # Any role change
    'data_export': 1,          # Large data exports
}

def check_alert_threshold(event_type, user_id):
    count = get_recent_event_count(event_type, user_id, hours=1)
    if count >= ALERT_THRESHOLDS.get(event_type, float('inf')):
        send_security_alert(
            event_type=event_type,
            user_id=user_id,
            count=count,
            severity='high' if event_type in ['admin_login', 'privilege_escalation'] else 'medium'
        )
```

### Alert Configuration

```python
# Security monitoring rules
MONITORING_RULES = [
    {
        'name': 'brute_force_detection',
        'condition': 'failed_logins > 5 in 5 minutes from same IP',
        'action': 'block_ip, alert_security_team'
    },
    {
        'name': 'impossible_travel',
        'condition': 'login from geographically impossible location',
        'action': 'require_mfa, alert_user'
    },
    {
        'name': 'off_hours_admin',
        'condition': 'admin action outside business hours',
        'action': 'alert_security_team'
    },
    {
        'name': 'mass_data_access',
        'condition': 'data export > 10000 records',
        'action': 'alert_security_team, require_approval'
    }
]
```

---

## Audit Trail Requirements

### Immutable Audit Logs

```python
# VULNERABLE: Mutable logs
def delete_audit_log(log_id):
    AuditLog.query.filter_by(id=log_id).delete()  # Can be deleted

# SAFE: Append-only audit logs
class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, nullable=False)
    event_type = db.Column(db.String, nullable=False)
    user_id = db.Column(db.Integer)
    details = db.Column(db.JSON)
    checksum = db.Column(db.String)  # Hash of previous entry

    @classmethod
    def create(cls, event_type, user_id, details):
        # Get previous entry's checksum for chain
        prev = cls.query.order_by(cls.id.desc()).first()
        prev_checksum = prev.checksum if prev else 'genesis'

        entry = cls(
            timestamp=datetime.utcnow(),
            event_type=event_type,
            user_id=user_id,
            details=details
        )
        # Chain checksum
        entry.checksum = hashlib.sha256(
            f"{prev_checksum}{entry.timestamp}{entry.event_type}".encode()
        ).hexdigest()
        db.session.add(entry)
        db.session.commit()
        return entry

# No delete method - audit logs are immutable
```

### Retention Requirements

```python
# Configure retention based on compliance requirements
LOG_RETENTION = {
    'security_events': 365,      # 1 year
    'authentication': 90,         # 90 days
    'access_logs': 30,           # 30 days
    'debug_logs': 7,             # 7 days
    'audit_trail': 2555,         # 7 years (compliance)
}

def cleanup_old_logs():
    for log_type, days in LOG_RETENTION.items():
        cutoff = datetime.utcnow() - timedelta(days=days)
        delete_logs_before(log_type, cutoff)
```

---

## Grep Patterns for Detection

```bash
# Missing security logging
grep -rn "def login\|def authenticate" --include="*.py" | xargs -I {} grep -L "logger\|logging" {}

# Sensitive data in logs
grep -rn "logger.*password\|logging.*password\|log.*password" --include="*.py"
grep -rn "logger.*token\|logger.*secret\|logger.*key" --include="*.py"

# Unsanitized log input
grep -rn "logger.*f\"\|logger.*%s.*%" --include="*.py"

# Missing log rotation
grep -rn "basicConfig.*filename\|FileHandler" --include="*.py" | grep -v "Rotating"

# World-readable logs
grep -rn "chmod.*644\|chmod.*755" --include="*.py" | grep -i log
```

---

## Testing Checklist

- [ ] Authentication events (success/failure) logged
- [ ] Authorization failures logged
- [ ] Sensitive operations logged (password change, role change)
- [ ] No passwords/tokens/secrets in logs
- [ ] Log injection prevented (newlines sanitized)
- [ ] Logs have restricted file permissions
- [ ] Log rotation configured
- [ ] Centralized logging for production
- [ ] Alerts configured for security events
- [ ] Audit trail is immutable
- [ ] Log retention meets compliance requirements

---

## References

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [OWASP Logging Vocabulary](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html)
- [CWE-778: Insufficient Logging](https://cwe.mitre.org/data/definitions/778.html)
- [CWE-532: Information Exposure Through Log Files](https://cwe.mitre.org/data/definitions/532.html)
