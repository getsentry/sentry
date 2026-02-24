# Python Security Patterns

## Framework Detection

| Indicator | Framework |
|-----------|-----------|
| `from django`, `settings.py`, `urls.py`, `views.py` | Django |
| `from flask`, `@app.route` | Flask |
| `from fastapi`, `@app.get`, `@app.post` | FastAPI |
| `import tornado` | Tornado |
| `from pyramid` | Pyramid |

---

## Django

### Server-Controlled Values (NEVER Flag)

Django settings are **deployment configuration**, not attacker input:

```python
# SAFE: All django.conf.settings values are server-controlled
from django.conf import settings

requests.get(settings.EXTERNAL_API_URL)      # NOT SSRF - configured at deployment
requests.get(f"{settings.SEER_URL}{path}")   # NOT SSRF - base URL is server-controlled
open(settings.LOG_FILE_PATH)                 # NOT path traversal
db.connect(settings.DATABASE_URL)            # NOT injection

# SAFE: Environment-based configuration
API_URL = os.environ.get('API_URL')
requests.get(API_URL)  # Server operator controls this

# SAFE: Settings from Django's settings.py
DEBUG = settings.DEBUG
ALLOWED_HOSTS = settings.ALLOWED_HOSTS
SECRET_KEY = settings.SECRET_KEY  # (check it's not hardcoded in repo though)
```

**Only flag settings-based code if:**
- The setting value itself is hardcoded in committed code (secrets exposure)
- The setting value is somehow derived from user input (rare, investigate)

### Auto-Escaped (Do Not Flag)

```python
# SAFE: Django auto-escapes template variables
{{ variable }}
{{ user.name }}
{{ form.field }}

# SAFE: ORM methods are parameterized
User.objects.filter(username=user_input)
User.objects.get(id=user_id)
User.objects.exclude(status=status)
MyModel.objects.create(name=name)

# SAFE: Django's built-in CSRF protection (if enabled)
{% csrf_token %}
@csrf_protect
```

### Flag These (Django-Specific)

```python
# XSS - Explicit unsafe marking
{{ variable|safe }}                    # FLAG: Disables escaping
{% autoescape off %}...{% endautoescape %}  # FLAG: Disables escaping
mark_safe(user_input)                  # FLAG: If user_input is user-controlled
format_html() with unescaped input     # CHECK: Depends on usage

# SQL Injection
User.objects.raw(f"SELECT * FROM users WHERE name = '{user_input}'")  # FLAG
User.objects.extra(where=[f"name = '{user_input}'"])  # FLAG (deprecated)
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")  # FLAG
RawSQL(f"SELECT * FROM x WHERE y = '{input}'")  # FLAG
connection.execute(query % user_input)  # FLAG

# Command Injection
os.system(f"cmd {user_input}")  # FLAG
subprocess.run(cmd, shell=True)  # FLAG if cmd contains user input
subprocess.Popen(cmd, shell=True)  # FLAG if cmd contains user input

# Deserialization
pickle.loads(user_data)  # FLAG: Always critical
yaml.load(user_data)  # FLAG: Use yaml.safe_load()
yaml.load(data, Loader=yaml.Loader)  # FLAG: Unsafe loader

# File Operations
open(user_controlled_path)  # CHECK: Path traversal
send_file(user_path)  # CHECK: Path traversal
```

### Django Security Settings

```python
# Check settings.py for:

# VULNERABLE configurations
DEBUG = True  # FLAG in production
ALLOWED_HOSTS = ['*']  # FLAG
SECRET_KEY = 'hardcoded-value'  # FLAG if committed
CSRF_COOKIE_SECURE = False  # FLAG in production
SESSION_COOKIE_SECURE = False  # FLAG in production

# Missing security middleware - CHECK if absent
MIDDLEWARE = [
    # Should include:
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
]
```

---

## Flask

### Safe Patterns (Do Not Flag)

```python
# SAFE: Jinja2 auto-escapes by default
{{ variable }}
render_template('template.html', name=user_input)

# SAFE: Parameterized queries with SQLAlchemy
db.session.query(User).filter(User.name == user_input)
db.session.execute(text("SELECT * FROM users WHERE id = :id"), {"id": user_id})

# SAFE: Flask-WTF CSRF (if configured)
form.validate_on_submit()
```

### Flag These (Flask-Specific)

```python
# XSS
Markup(user_input)  # FLAG: Marks as safe HTML
render_template_string(user_input)  # FLAG: SSTI vulnerability
{{ variable|safe }}  # FLAG in templates

# SQL Injection
db.engine.execute(f"SELECT * FROM users WHERE name = '{user_input}'")  # FLAG
text(f"SELECT * FROM users WHERE id = {user_id}")  # FLAG

# SSTI (Server-Side Template Injection)
render_template_string(user_controlled_template)  # FLAG: Critical
Template(user_input).render()  # FLAG: Critical

# Session Security
app.secret_key = 'hardcoded'  # FLAG
app.config['SECRET_KEY'] = 'weak'  # FLAG

# Debug Mode
app.run(debug=True)  # FLAG in production
app.debug = True  # FLAG in production
```

---

## FastAPI

### Safe Patterns (Do Not Flag)

```python
# SAFE: Pydantic validates and sanitizes
@app.post("/users/")
async def create_user(user: UserCreate):  # Pydantic model validates
    pass

# SAFE: Path parameters with type hints
@app.get("/users/{user_id}")
async def get_user(user_id: int):  # Validated as int
    pass

# SAFE: SQLAlchemy ORM
db.query(User).filter(User.id == user_id).first()
```

### Flag These (FastAPI-Specific)

```python
# SQL Injection (same as Flask/SQLAlchemy)
db.execute(f"SELECT * FROM users WHERE id = {user_id}")  # FLAG
text(f"SELECT * FROM users WHERE name = '{name}'")  # FLAG

# Response without validation
@app.get("/data")
async def get_data():
    return user_controlled_dict  # CHECK: May expose sensitive fields

# Dependency injection bypass
@app.get("/admin")
async def admin(user: User = Depends(get_current_user)):
    # CHECK: Ensure get_current_user validates properly
    pass
```

---

## General Python

### Always Flag

```python
# Deserialization - Always Critical
pickle.loads(data)
pickle.load(file)
cPickle.loads(data)
shelve.open(user_path)
marshal.loads(data)
yaml.load(data)  # Without Loader=SafeLoader
yaml.load(data, Loader=yaml.FullLoader)  # Still unsafe
yaml.load(data, Loader=yaml.UnsafeLoader)

# Code Execution - Always Critical
eval(user_input)
exec(user_input)
compile(user_input, '<string>', 'exec')
__import__(user_input)

# Command Injection - Critical
os.system(user_cmd)
os.popen(user_cmd)
subprocess.call(cmd, shell=True)  # If cmd has user input
subprocess.run(cmd, shell=True)   # If cmd has user input
subprocess.Popen(cmd, shell=True) # If cmd has user input
commands.getoutput(user_cmd)  # Python 2
```

### Check Context

```python
# SSRF - Check if URL is user-controlled
requests.get(user_url)
urllib.request.urlopen(user_url)
httpx.get(user_url)
aiohttp.ClientSession().get(user_url)

# Path Traversal - Check if path is user-controlled
open(user_path)
pathlib.Path(user_path).read_text()
os.path.join(base, user_input)  # ../../../etc/passwd possible
shutil.copy(user_src, user_dst)

# Weak Crypto - Check if for security purpose
hashlib.md5(password)  # FLAG if for passwords
hashlib.sha1(password)  # FLAG if for passwords
random.random()  # FLAG if for security (use secrets module)
random.randint()  # FLAG if for security

# Safe Alternatives
secrets.token_hex()  # For tokens
secrets.token_urlsafe()  # For URL-safe tokens
hashlib.pbkdf2_hmac()  # For password hashing
bcrypt.hashpw()  # For password hashing
```

### Input Validation

```python
# VULNERABLE: No validation
def process(data):
    return eval(data['expression'])

# SAFE: Type validation
def process(data: dict):
    if not isinstance(data.get('value'), int):
        raise ValueError("Invalid input")
    return data['value'] * 2

# SAFE: Schema validation
from pydantic import BaseModel, validator

class UserInput(BaseModel):
    name: str
    age: int

    @validator('name')
    def name_must_be_safe(cls, v):
        if not v.isalnum():
            raise ValueError('Name must be alphanumeric')
        return v
```

---

## SQLAlchemy Patterns

### Safe (Do Not Flag)

```python
# ORM methods - automatically parameterized
session.query(User).filter(User.name == name)
session.query(User).filter_by(name=name)
User.query.filter(User.id == id).first()

# Parameterized text queries
from sqlalchemy import text
session.execute(text("SELECT * FROM users WHERE id = :id"), {"id": user_id})
```

### Flag These

```python
# String interpolation in queries
session.execute(f"SELECT * FROM users WHERE name = '{name}'")
session.execute("SELECT * FROM users WHERE name = '%s'" % name)
session.execute("SELECT * FROM users WHERE name = '" + name + "'")

# text() with interpolation
session.execute(text(f"SELECT * FROM users WHERE id = {user_id}"))
```

---

## Common Mistakes

### Type Confusion

```python
# VULNERABLE: JSON numbers become floats
data = request.get_json()
user_id = data['id']  # Could be float, string, dict, etc.
User.query.get(user_id)  # May behave unexpectedly

# SAFE: Explicit type conversion
user_id = int(data['id'])
```

### Race Conditions

```python
# VULNERABLE: TOCTOU
if user.balance >= amount:
    # Another request could modify balance here
    user.balance -= amount

# SAFE: Atomic operation
User.query.filter(User.id == user_id, User.balance >= amount).update(
    {User.balance: User.balance - amount}
)
```

---

## Grep Patterns

```bash
# Django unsafe patterns
grep -rn "mark_safe\||safe\|autoescape off\|\.raw(\|\.extra(" --include="*.py"

# Flask SSTI
grep -rn "render_template_string\|Template(" --include="*.py"

# Deserialization
grep -rn "pickle\.load\|yaml\.load\|marshal\.load" --include="*.py"

# Command injection
grep -rn "os\.system\|subprocess.*shell=True\|os\.popen" --include="*.py"

# SQL injection
grep -rn "execute.*f\"\|execute.*%\|\.raw.*f\"" --include="*.py"
```
