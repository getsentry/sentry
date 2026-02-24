# Cross-Site Scripting (XSS) Prevention Reference

## Overview

XSS occurs when applications include untrusted data in web pages without proper validation or escaping. Attackers can execute scripts in victims' browsers to hijack sessions, deface websites, or redirect users to malicious sites.

## XSS Types

| Type | Description | Example |
|------|-------------|---------|
| **Reflected** | Malicious script from current HTTP request | URL parameter rendered in response |
| **Stored** | Malicious script stored in target server | Comment field saved and displayed |
| **DOM-based** | Vulnerability in client-side code | JavaScript reads URL and writes to DOM |

## Output Encoding by Context

### HTML Body Context

```javascript
// VULNERABLE: innerHTML with user data
element.innerHTML = userInput;

// SAFE: Use textContent
element.textContent = userInput;

// SAFE: Use createTextNode
document.createTextNode(userInput);
```

**HTML Entity Encoding**
| Character | Encoding |
|-----------|----------|
| `<` | `&lt;` |
| `>` | `&gt;` |
| `&` | `&amp;` |
| `"` | `&quot;` |
| `'` | `&#x27;` |

### HTML Attribute Context

```html
<!-- VULNERABLE: Unquoted attribute -->
<input value=${userInput}>

<!-- VULNERABLE: Event handler with user data -->
<button onclick="doSomething('${userInput}')">

<!-- SAFE: Quoted attribute with encoding -->
<input value="${htmlEncode(userInput)}">
```

**Rules:**
- Always quote attribute values
- Never place user input in event handlers (`onclick`, `onerror`, etc.)
- Use `setAttribute()` which auto-encodes

### JavaScript Context

```javascript
// VULNERABLE: eval with user input
eval(userInput);

// VULNERABLE: setTimeout with string
setTimeout("doSomething('" + userInput + "')", 1000);

// VULNERABLE: Function constructor
new Function("return " + userInput)();

// SAFE: JSON encoding for data
const data = JSON.parse(jsonString);

// SAFE: setTimeout with function
setTimeout(() => doSomething(userInput), 1000);
```

**Safe JavaScript Locations** (with proper encoding):
- Inside quoted string values only
- Never directly in script blocks

### URL Context

```javascript
// VULNERABLE: User input in href
element.href = userInput;

// VULNERABLE: javascript: URL scheme
<a href="javascript:${userInput}">

// SAFE: Validate URL scheme
const url = new URL(userInput);
if (url.protocol === 'https:' || url.protocol === 'http:') {
    element.href = url.toString();
}

// SAFE: Encode URL parameters
const encoded = encodeURIComponent(userInput);
```

### CSS Context

```css
/* VULNERABLE: User input in style */
.element { background: url(${userInput}); }

/* VULNERABLE: Expression in CSS */
.element { behavior: expression(${userInput}); }
```

**Rules:**
- Place user data only in CSS property values
- Never allow user input in selectors or URLs

---

## Safe DOM Sinks

**Use These:**
```javascript
elem.textContent = variable;
elem.insertAdjacentText('beforeend', variable);
elem.className = variable;  // for class names
elem.setAttribute('data-value', variable);
formField.value = variable;
document.createTextNode(variable);
```

**Avoid These:**
```javascript
elem.innerHTML = variable;        // XSS
elem.outerHTML = variable;        // XSS
document.write(variable);         // XSS
document.writeln(variable);       // XSS
eval(variable);                   // Code execution
setTimeout(variable);             // If string argument
setInterval(variable);            // If string argument
new Function(variable);           // Code execution
elem.insertAdjacentHTML();        // XSS
elem.onevent = variable;          // Event handler
```

---

## Framework-Specific Considerations

### React

```jsx
// SAFE: Auto-escaped by default
<div>{userInput}</div>

// VULNERABLE: dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{__html: userInput}} />

// SAFE: Sanitize before using dangerouslySetInnerHTML
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(userInput)}} />
```

### Angular

```typescript
// SAFE: Auto-escaped by default
<div>{{ userInput }}</div>

// VULNERABLE: bypassSecurityTrust*
this.sanitizer.bypassSecurityTrustHtml(userInput);

// Use bypassSecurityTrust* only with sanitized input
```

### Vue

```html
<!-- SAFE: Auto-escaped -->
<div>{{ userInput }}</div>

<!-- VULNERABLE: v-html directive -->
<div v-html="userInput"></div>

<!-- SAFE: Sanitize first -->
<div v-html="sanitizedInput"></div>
```

### Django/Jinja2

```django
<!-- SAFE: Auto-escaped by default -->
{{ user_input }}

<!-- VULNERABLE: |safe filter -->
{{ user_input|safe }}

<!-- VULNERABLE: {% autoescape off %} -->
{% autoescape off %}
    {{ user_input }}
{% endautoescape %}
```

---

## HTML Sanitization

When users must submit HTML (rich text editors), use a sanitization library.

```javascript
// Recommended: DOMPurify
import DOMPurify from 'dompurify';

const clean = DOMPurify.sanitize(dirty);

// With configuration
const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
});
```

**Key Points:**
- Keep sanitization libraries updated
- Configure allowed tags/attributes based on needs
- Sanitize on output, not just input

---

## Content Security Policy (CSP)

CSP provides defense-in-depth but should not be the primary XSS defense.

### Strict CSP (Recommended)

```
Content-Security-Policy:
    default-src 'self';
    script-src 'nonce-{RANDOM}' 'strict-dynamic';
    object-src 'none';
    base-uri 'none';
```

### Nonce-Based Approach

```html
<!-- Server generates unique nonce per request -->
<script nonce="r4nd0m123">
    // Allowed script
</script>

<script>
    // Blocked - no nonce
</script>
```

### Hash-Based Approach

```
Content-Security-Policy: script-src 'sha256-base64hash...'
```

---

## DOM-based XSS Prevention

### Dangerous Sources

```javascript
// Attacker-controllable sources
location.hash
location.search
document.referrer
window.name
postMessage data
```

### Prevention

```javascript
// VULNERABLE: Direct use of source in sink
element.innerHTML = location.hash.slice(1);

// SAFE: Validate and encode
const hash = location.hash.slice(1);
if (/^[a-zA-Z0-9-]+$/.test(hash)) {
    element.textContent = hash;
}
```

---

## Key Grep Patterns for Detection

```bash
# Dangerous DOM sinks
grep -rn "innerHTML\|outerHTML\|document\.write" --include="*.js" --include="*.jsx"
grep -rn "dangerouslySetInnerHTML" --include="*.jsx" --include="*.tsx"
grep -rn "v-html" --include="*.vue"
grep -rn "\|safe\|autoescape off" --include="*.html" --include="*.jinja"

# Dangerous JavaScript
grep -rn "eval(\|Function(\|setTimeout.*string\|setInterval.*string" --include="*.js"

# Framework bypasses
grep -rn "bypassSecurityTrust" --include="*.ts"
grep -rn "mark_safe\|SafeString" --include="*.py"
```

---

## Testing Payloads

**Basic:**
```
<script>alert('XSS')</script>
<img src=x onerror=alert('XSS')>
<svg onload=alert('XSS')>
```

**Attribute Escape:**
```
" onmouseover="alert('XSS')
' onclick='alert("XSS")
```

**JavaScript Context:**
```
';alert('XSS')//
\';alert(\'XSS\')//
</script><script>alert('XSS')</script>
```

---

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP DOM-based XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [CWE-79: Cross-site Scripting](https://cwe.mitre.org/data/definitions/79.html)
