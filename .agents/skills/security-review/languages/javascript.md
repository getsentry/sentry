# JavaScript/TypeScript Security Patterns

## Framework Detection

| Indicator | Framework |
|-----------|-----------|
| `import React`, `jsx`, `tsx`, `useState` | React |
| `import Vue`, `.vue` files, `v-bind`, `v-model` | Vue |
| `import express`, `app.get`, `app.post` | Express |
| `import { Controller }`, `@nestjs` | NestJS |
| `import next`, `getServerSideProps` | Next.js |
| `import angular`, `@Component` | Angular |

---

## React

### Auto-Escaped (Do Not Flag)

```jsx
// SAFE: JSX auto-escapes interpolated values
<div>{userInput}</div>
<span>{user.name}</span>
<p>{data.description}</p>

// SAFE: Setting attributes (except href/src)
<div className={userInput}>
<input value={userInput} />
<div data-value={userInput}>
```

### Flag These (React-Specific)

```jsx
// XSS - Explicit unsafe rendering
<div dangerouslySetInnerHTML={{__html: userInput}} />  // FLAG: Critical
// Only safe if userInput is sanitized with DOMPurify or similar

// URL-based XSS
<a href={userInput}>Link</a>  // FLAG: Check for javascript: protocol
<iframe src={userInput} />    // FLAG: Check for javascript: protocol
<script src={userInput} />    // FLAG

// eval patterns
eval(userInput)               // FLAG: Critical
new Function(userInput)       // FLAG: Critical
setTimeout(userInput, 1000)   // FLAG: If string argument
setInterval(userInput, 1000)  // FLAG: If string argument
```

### React Security Checklist

```jsx
// CHECK: URL validation for href/src
const SafeLink = ({url, children}) => {
    const isValid = url.startsWith('https://') || url.startsWith('/');
    if (!isValid) return null;
    return <a href={url}>{children}</a>;
};

// CHECK: Sanitize before dangerouslySetInnerHTML
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(html)}} />
```

---

## Vue

### Auto-Escaped (Do Not Flag)

```vue
<!-- SAFE: Vue auto-escapes interpolation -->
<div>{{ userInput }}</div>
<span>{{ user.name }}</span>

<!-- SAFE: v-bind for attributes -->
<div :class="userInput">
<input :value="userInput" />
```

### Flag These (Vue-Specific)

```vue
<!-- XSS - Renders raw HTML -->
<div v-html="userInput"></div>  <!-- FLAG: Critical -->

<!-- URL-based XSS -->
<a :href="userInput">           <!-- FLAG: Check protocol -->
<iframe :src="userInput" />     <!-- FLAG: Check protocol -->
```

### Vue Security Patterns

```javascript
// FLAG: Dynamic component with user input
<component :is="userInput" />  // Could load arbitrary component

// FLAG: Template compilation with user input
Vue.compile(userTemplate)      // Server-side template injection
new Vue({ template: userInput })
```

---

## Express / Node.js

### Safe Patterns (Do Not Flag)

```javascript
// SAFE: Parameterized queries (most ORMs)
User.findOne({ where: { id: userId } });  // Sequelize
db.collection('users').findOne({ _id: userId });  // MongoDB with proper driver

// SAFE: res.json auto-serializes
res.json({ data: userInput });

// SAFE: Template engines escape by default
res.render('template', { name: userInput });  // EJS, Pug, Handlebars
```

### Flag These (Express-Specific)

```javascript
// SQL Injection
db.query(`SELECT * FROM users WHERE id = ${userId}`);  // FLAG
connection.query('SELECT * FROM users WHERE name = "' + name + '"');  // FLAG

// NoSQL Injection
db.collection('users').find({ $where: userInput });  // FLAG: Code execution
db.collection('users').find({ name: { $regex: userInput } });  // FLAG: ReDoS

// Command Injection
exec(userInput);                    // FLAG: Critical
execSync(userInput);                // FLAG: Critical
spawn(cmd, { shell: true });        // FLAG: If cmd has user input
child_process.exec(userCmd);        // FLAG: Critical

// Path Traversal
res.sendFile(userPath);             // FLAG: Check path validation
fs.readFile(userPath);              // FLAG: Check path validation
path.join(base, userInput);         // FLAG: ../../../ possible

// SSRF
fetch(userUrl);                     // FLAG: Check URL validation
axios.get(userUrl);                 // FLAG: Check URL validation
http.get(userUrl);                  // FLAG: Check URL validation

// Prototype Pollution
Object.assign(target, userObject);  // FLAG: If userObject from request
_.merge(target, userObject);        // FLAG: Check lodash version
$.extend(true, target, userObject); // FLAG
```

### MongoDB Injection

```javascript
// VULNERABLE: Operator injection
db.users.find({
    username: req.body.username,  // Could be { $gt: '' }
    password: req.body.password   // Could be { $gt: '' }
});

// SAFE: Type coercion
db.users.find({
    username: String(req.body.username),
    password: String(req.body.password)
});

// SAFE: Schema validation (Mongoose)
const userSchema = new Schema({
    username: { type: String, required: true },
    password: { type: String, required: true }
});
```

---

## Next.js

### Safe Patterns

```jsx
// SAFE: getServerSideProps data is serialized
export async function getServerSideProps() {
    const data = await fetchData();
    return { props: { data } };  // Safe serialization
}

// SAFE: API routes with proper validation
export default function handler(req, res) {
    const { id } = req.query;
    // Validate id before use
}
```

### Flag These (Next.js-Specific)

```jsx
// SSRF in getServerSideProps
export async function getServerSideProps({ query }) {
    const data = await fetch(query.url);  // FLAG: SSRF
    return { props: { data } };
}

// Exposed API keys
const data = await fetch(process.env.API_KEY);  // CHECK: Client-side exposure
// NEXT_PUBLIC_ env vars are exposed to client

// dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{__html: props.content}} />  // FLAG
```

---

## Angular

### Auto-Escaped (Do Not Flag)

```typescript
// SAFE: Angular auto-escapes interpolation
<div>{{ userInput }}</div>
<span>{{ user.name }}</span>

// SAFE: Property binding
<div [innerHTML]="trustedHtml">  // Sanitized by DomSanitizer
```

### Flag These (Angular-Specific)

```typescript
// XSS - Bypassing sanitization
this.sanitizer.bypassSecurityTrustHtml(userInput);      // FLAG
this.sanitizer.bypassSecurityTrustScript(userInput);    // FLAG
this.sanitizer.bypassSecurityTrustUrl(userInput);       // FLAG
this.sanitizer.bypassSecurityTrustResourceUrl(userInput); // FLAG

// Only safe with server-validated content, never user input
```

---

## General JavaScript

### Always Flag

```javascript
// Code Execution - Critical
eval(userInput);
new Function(userInput)();
setTimeout(userInput, ms);       // String form
setInterval(userInput, ms);      // String form
script.innerHTML = userInput;
document.write(userInput);

// DOM XSS Sinks - Critical with user input
element.innerHTML = userInput;
element.outerHTML = userInput;
element.insertAdjacentHTML('beforeend', userInput);
document.write(userInput);
document.writeln(userInput);

// URL-based XSS
location = userInput;            // Open redirect / javascript:
location.href = userInput;
window.open(userInput);
```

### Check Context

```javascript
// Safe DOM APIs (no XSS)
element.textContent = userInput;  // SAFE: Text only
element.innerText = userInput;    // SAFE: Text only
element.setAttribute('data-x', userInput);  // SAFE: Non-event attrs
document.createTextNode(userInput);  // SAFE

// Dangerous DOM APIs (check if user-controlled)
element.innerHTML = content;      // CHECK: Is content user-controlled?
element.src = url;               // CHECK: Is url user-controlled?
element.href = url;              // CHECK: javascript: protocol?
```

---

## Prototype Pollution

### Vulnerable Patterns

```javascript
// FLAG: Object merge with user input
function merge(target, source) {
    for (let key in source) {
        target[key] = source[key];  // __proto__ can be set
    }
}
merge({}, JSON.parse(userInput));  // FLAG

// FLAG: Common vulnerable libraries (check versions)
_.merge(target, userInput);        // lodash < 4.17.12
$.extend(true, target, userInput); // jQuery deep extend
```

### Safe Patterns

```javascript
// SAFE: Prototype pollution prevention
function safeMerge(target, source) {
    for (let key in source) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            continue;
        }
        target[key] = source[key];
    }
}

// SAFE: Object.create(null)
const obj = Object.create(null);  // No prototype chain

// SAFE: Map instead of Object
const map = new Map();
map.set(userKey, userValue);  // Keys don't affect prototype
```

---

## TypeScript-Specific

### Type Safety Doesn't Prevent Runtime Attacks

```typescript
// TypeScript types don't validate at runtime
interface UserInput {
    id: number;
    name: string;
}

// VULNERABLE: Runtime value could be anything
const input: UserInput = req.body as UserInput;  // No actual validation
db.query(`SELECT * FROM users WHERE id = ${input.id}`);  // Still SQL injection

// SAFE: Runtime validation
import { z } from 'zod';
const UserInput = z.object({
    id: z.number(),
    name: z.string()
});
const input = UserInput.parse(req.body);  // Throws if invalid
```

### Any Type Warnings

```typescript
// CHECK: 'any' type bypasses type safety
function process(data: any) {  // No type checking
    eval(data.code);  // Could be anything
}
```

---

## Grep Patterns

```bash
# DOM XSS
grep -rn "innerHTML\|outerHTML\|document\.write" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"

# React dangerous patterns
grep -rn "dangerouslySetInnerHTML" --include="*.jsx" --include="*.tsx"

# Vue dangerous patterns
grep -rn "v-html" --include="*.vue"

# eval and Function
grep -rn "eval(\|new Function(\|setTimeout.*string\|setInterval.*string" --include="*.js" --include="*.ts"

# Command injection
grep -rn "child_process\|exec(\|execSync(\|spawn(" --include="*.js" --include="*.ts"

# Prototype pollution
grep -rn "__proto__\|constructor\[" --include="*.js" --include="*.ts"

# SQL/NoSQL injection
grep -rn "\\\`SELECT.*\\\${\|\$where\|\.find({.*:.*req\." --include="*.js" --include="*.ts"

# Angular bypass
grep -rn "bypassSecurityTrust" --include="*.ts"
```
