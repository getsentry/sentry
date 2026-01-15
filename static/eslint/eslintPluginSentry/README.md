# @sentry Custom ESLint Rules

Custom ESLint rules for the Sentry codebase.

## Rules

### `@sentry/no-static-translations`

Requires using `ATTRIBUTE_METADATA[key].brief` pattern in `td()` calls.

### `@sentry/default-export-function-style`

Enforces consistent style for default exports of functions and classes.

#### Options

This rule accepts a single string option:

- `"statement"` (default): Requires default exports to be inline with the function/class declaration
- `"inline"`: Requires default exports to be separate from the declaration

#### Examples

##### ✅ Correct with `"statement"` (default)

```js
// Functions declared inline with export
export default function MyComponent() {
  return <div>Hello</div>;
}

// Classes declared inline with export
export default class MyClass {
  constructor() {}
}
```

##### ❌ Incorrect with `"statement"` (default)

```js
// Separate function declaration and export
function MyComponent() {
  return <div>Hello</div>;
}
export default MyComponent;

// Arrow functions with separate export
const MyComponent = () => {
  return <div>Hello</div>;
};
export default MyComponent;

// Function expressions with separate export
const MyComponent = function() {
  return <div>Hello</div>;
};
export default MyComponent;

// Separate class declaration and export
class MyClass {
  constructor() {}
}
export default MyClass;
```

##### ✅ Correct with `"inline"`

```js
// Functions declared separately from export
function MyComponent() {
  return <div>Hello</div>;
}
export default MyComponent;

// Arrow functions with separate export
const MyComponent = () => {
  return <div>Hello</div>;
};
export default MyComponent;

// Classes declared separately from export
class MyClass {
  constructor() {}
}
export default MyClass;
```

##### ❌ Incorrect with `"inline"`

```js
// Functions declared inline with export
export default function MyComponent() {
  return <div>Hello</div>;
}

// Classes declared inline with export
export default class MyClass {
  constructor() {}
}
```

#### Autofix

This rule provides automatic fixing for all violations:

**Statement mode** transforms:

```js
// Before
function MyComponent() {
  return <div>Hello</div>;
}
export default MyComponent;

// After
export default function MyComponent() {
  return <div>Hello</div>;
}
```

**Inline mode** transforms:

```js
// Before
export default function MyComponent() {
  return <div>Hello</div>;
}

// After
function MyComponent() {
  return <div>Hello</div>;
}
export default MyComponent;
```

#### When Not To Use

- If you're okay with inconsistent export styles across your codebase
- If you have many files with JSDoc comments on exported functions (the rule preserves JSDoc comments and won't transform them)

#### Configuration

In your ESLint config:

```js
{
  rules: {
    // Use statement mode (default)
    '@sentry/default-export-function-style': 'error',

    // Or explicitly
    '@sentry/default-export-function-style': ['error', 'statement'],

    // Use inline mode
    '@sentry/default-export-function-style': ['error', 'inline'],
  }
}
```

#### Related Rules

- `import/no-anonymous-default-export`: Disallows anonymous default exports
- `react/function-component-definition`: Enforces consistent function component definitions (React-specific)

#### Implementation Notes

- The rule preserves JSDoc block comments and won't transform functions/classes that have them
- Anonymous exports (`export default () => {}`, `export default function() {}`) are not affected by this rule
- The rule only applies to functions and classes, not to other values like objects or primitives
- In statement mode, arrow functions are converted to regular function declarations during autofix
