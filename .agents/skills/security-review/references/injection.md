# Injection Prevention Reference

## Overview

Injection flaws occur when untrusted data is sent to an interpreter as part of a command or query. The attacker's hostile data tricks the interpreter into executing unintended commands or accessing data without proper authorization.

## SQL Injection

### Primary Defenses

**1. Prepared Statements (Parameterized Queries) - REQUIRED**

The database distinguishes between code and data regardless of user input.

```java
// SAFE: Parameterized query
String query = "SELECT * FROM users WHERE username = ?";
PreparedStatement pstmt = connection.prepareStatement(query);
pstmt.setString(1, userInput);
```

```python
# SAFE: Parameterized query
cursor.execute("SELECT * FROM users WHERE username = %s", (user_input,))
```

```javascript
// SAFE: Parameterized query (node-postgres)
const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
```

**2. Stored Procedures**

Safe when implemented without dynamic SQL construction.

```java
// SAFE: Stored procedure
CallableStatement cs = connection.prepareCall("{call sp_getUser(?)}");
cs.setString(1, username);
```

**3. Allow-list Input Validation**

For elements that cannot be parameterized (table names, column names, sort order).

```java
// SAFE: Allowlist for table names
switch(tableName) {
    case "users": return "users";
    case "orders": return "orders";
    default: throw new InputValidationException("Invalid table");
}
```

### Vulnerable Patterns to Find

```python
# VULNERABLE: String concatenation
query = "SELECT * FROM users WHERE name = '" + user_input + "'"

# VULNERABLE: f-string interpolation
query = f"SELECT * FROM users WHERE id = {user_id}"

# VULNERABLE: format() method
query = "SELECT * FROM users WHERE name = '{}'".format(user_input)
```

```javascript
// VULNERABLE: Template literal
const query = `SELECT * FROM users WHERE id = ${userId}`;

// VULNERABLE: String concatenation
const query = "SELECT * FROM users WHERE name = '" + userName + "'";
```

### ORM Safety Considerations

**Django ORM**
```python
# SAFE: ORM methods
User.objects.filter(username=user_input)

# VULNERABLE: raw() with interpolation
User.objects.raw(f"SELECT * FROM users WHERE name = '{user_input}'")

# VULNERABLE: extra() with unvalidated input
User.objects.extra(where=[f"name = '{user_input}'"])
```

**SQLAlchemy**
```python
# SAFE: ORM methods
session.query(User).filter(User.name == user_input)

# VULNERABLE: text() with interpolation
session.execute(text(f"SELECT * FROM users WHERE name = '{user_input}'"))
```

---

## NoSQL Injection

### MongoDB Injection Patterns

```javascript
// VULNERABLE: User-controlled query operators
db.users.find({ username: req.body.username, password: req.body.password });
// Attack: { "username": "admin", "password": { "$gt": "" } }

// SAFE: Explicit type checking
const username = String(req.body.username);
const password = String(req.body.password);
db.users.find({ username: username, password: password });
```

**Dangerous Operators**
- `$where` - Allows JavaScript execution
- `$regex` - Can be used for ReDoS
- `$gt`, `$ne`, `$in` - Query manipulation when user-controlled

---

## OS Command Injection

### Primary Defenses

**1. Avoid Shell Commands - PREFERRED**

Use language built-in functions instead of shell commands.

```python
# VULNERABLE: Shell command
os.system(f"mkdir {directory_name}")

# SAFE: Built-in function
os.makedirs(directory_name, exist_ok=True)
```

**2. Parameterization**

```python
# VULNERABLE: Shell=True with user input
subprocess.run(f"convert {input_file} {output_file}", shell=True)

# SAFE: List of arguments, shell=False
subprocess.run(["convert", input_file, output_file], shell=False)
```

**3. Input Validation**

```python
# Allowlist for permitted commands
ALLOWED_COMMANDS = {"convert", "resize", "rotate"}
if command not in ALLOWED_COMMANDS:
    raise ValueError("Invalid command")

# Validate arguments against safe patterns
if not re.match(r'^[a-zA-Z0-9_\-\.]+$', filename):
    raise ValueError("Invalid filename")
```

### Dangerous Characters

Block or escape: `& | ; $ > < \ ! ' " ( ) { } [ ] \n \r`

### Language-Specific Dangerous Functions

| Language | Dangerous Functions |
|----------|-------------------|
| Python | `os.system()`, `subprocess.run(shell=True)`, `os.popen()`, `eval()`, `exec()` |
| JavaScript | `child_process.exec()`, `eval()` |
| PHP | `exec()`, `shell_exec()`, `system()`, `passthru()`, backticks |
| Ruby | `system()`, `exec()`, backticks, `%x{}` |
| Java | `Runtime.exec()`, `ProcessBuilder` with shell |

---

## LDAP Injection

### Prevention

```java
// SAFE: Escape special characters
String safeName = LdapEncoder.filterEncode(userName);
String filter = "(&(uid=" + safeName + ")(userPassword=" + safePassword + "))";
```

**Characters to Escape in LDAP**
- Filter context: `* ( ) \ NUL`
- DN context: `\ # + < > ; " = /`

---

## Template Injection

### Server-Side Template Injection (SSTI)

```python
# VULNERABLE: User input in template
template = Template(f"Hello {user_input}")

# SAFE: Pass user input as variable
template = Template("Hello {{ name }}")
template.render(name=user_input)
```

**Detection Payloads**
- Jinja2: `{{7*7}}` → `49`
- FreeMarker: `${7*7}` → `49`
- Thymeleaf: `[[${7*7}]]` → `49`

---

## XPath Injection

### Prevention

```java
// VULNERABLE: String concatenation
String query = "//users/user[name='" + userName + "']";

// SAFE: Use parameterized XPath
XPathExpression expr = xpath.compile("//users/user[name=$name]");
expr.setVariable("name", userName);
```

---

## Key Grep Patterns for Detection

```bash
# SQL Injection
grep -rn "execute.*+" --include="*.py"
grep -rn "raw_sql\|rawQuery\|raw(" --include="*.py" --include="*.js"
grep -rn "\\.query\\(.*\\+" --include="*.js"
grep -rn "\\$.*\\+" --include="*.php"

# Command Injection
grep -rn "os\\.system\\|subprocess\\.run.*shell=True\\|os\\.popen" --include="*.py"
grep -rn "child_process\\.exec" --include="*.js"
grep -rn "system(\\|exec(\\|shell_exec(" --include="*.php"

# Template Injection
grep -rn "Template(.*\\+" --include="*.py"
grep -rn "render_template_string" --include="*.py"

# LDAP Injection
grep -rn "ldap_search\\|ldap_bind" --include="*.py" --include="*.php"
```

---

## References

- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [OWASP OS Command Injection Defense](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html)
- [OWASP LDAP Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LDAP_Injection_Prevention_Cheat_Sheet.html)
- [CWE-89: SQL Injection](https://cwe.mitre.org/data/definitions/89.html)
- [CWE-78: OS Command Injection](https://cwe.mitre.org/data/definitions/78.html)
