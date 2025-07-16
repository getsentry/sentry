# MDX TypeScript Support Implementation

## Overview

This document outlines the implementation of TypeScript support for `.mdx` files in the Sentry project. The implementation provides full type checking, IntelliSense, and editor support for MDX files.

## What Was Implemented

### 1. TypeScript Module Declarations (`static/app/types/mdx.d.ts`)

Created comprehensive TypeScript declarations for MDX files with the following features:

- **Basic MDX Import Support**: Declares `.mdx` files as React components with proper typing
- **Named Exports**: Support for `meta`, `frontMatter`, and `types` exports from MDX files
- **Query Parameters**: Support for special imports like `*.mdx?frontmatter` and `*.mdx?raw`
- **Type Loader Integration**: Support for the custom `!!type-loader!` syntax used in the project

### 2. TypeScript Configuration Updates

Updated `config/tsconfig.base.json` to include MDX files:
- Added `../static/app/**/*.mdx` to the `include` array
- This ensures TypeScript processes MDX files alongside other source files

### 3. Dependencies

Installed `@types/mdx` package to provide:
- Core MDX type definitions
- Proper `MDXProps` interface
- Compatibility with the MDX ecosystem

## Current Project Support

The project already had excellent build-time support for MDX:

### Build System (rspack.config.ts)
- **MDX Loader**: Uses `@mdx-js/loader` for processing MDX files
- **Remark Plugins**: Includes frontmatter, GFM, and callout support
- **Rehype Plugins**: Includes expressive code highlighting
- **SWC Integration**: Processes MDX through SWC for React/TypeScript transformation

### ESLint Integration
- **eslint-plugin-mdx**: Already configured for linting MDX files
- **Flat Config**: Uses the modern ESLint flat configuration format

### Existing MDX Files
The project contains several MDX files used for component documentation:
- `static/app/components/core/alert/index.mdx`
- `static/app/components/core/button/index.mdx`
- `static/app/styles/colors.mdx`

## TypeScript Features Now Available

### 1. Import/Export Type Safety
```typescript
// Import MDX files with proper typing
import AlertDocs from 'sentry/components/core/alert/index.mdx';

// Access exported metadata with type safety
const types = AlertDocs.types;
const meta = AlertDocs.meta;
```

### 2. Component Props
```typescript
// MDX components now have proper React component typing
const MyMDXComponent: ComponentType<MDXProps> = AlertDocs;
```

### 3. Special Import Syntax
```typescript
// Import frontmatter data
import frontmatter from 'components/docs.mdx?frontmatter';

// Import raw MDX content
import rawContent from 'components/docs.mdx?raw';

// Import types (project-specific)
import types from '!!type-loader!components/SomeComponent';
```

## Usage Examples

### Basic MDX Component Import
```typescript
import React from 'react';
import MyDocs from 'sentry/components/core/button/index.mdx';

function DocsPage() {
  return (
    <div>
      <h1>Button Documentation</h1>
      <MyDocs />
    </div>
  );
}
```

### Accessing MDX Exports
```typescript
import AlertDocs from 'sentry/components/core/alert/index.mdx';

// TypeScript now knows these properties exist and their types
if (AlertDocs.types) {
  console.log('Available types:', AlertDocs.types);
}

if (AlertDocs.meta) {
  console.log('Metadata:', AlertDocs.meta);
}
```

## Benefits

1. **Type Safety**: Full TypeScript checking for MDX imports and usage
2. **IntelliSense**: Editor autocomplete and suggestions for MDX components
3. **Error Prevention**: Compile-time errors for invalid MDX usage
4. **Better DX**: Improved developer experience with proper TypeScript integration
5. **Documentation**: Self-documenting code through TypeScript interfaces

## Technical Details

### File Structure
```
static/app/
├── types/
│   └── mdx.d.ts          # MDX TypeScript declarations
├── components/
│   └── core/
│       ├── alert/
│       │   └── index.mdx # Example MDX file
│       └── button/
│           └── index.mdx # Example MDX file
└── styles/
    └── colors.mdx        # Example MDX file
```

### Dependencies Added
- `@types/mdx@^2.0.13` - Core MDX TypeScript definitions

### Configuration Files Modified
- `config/tsconfig.base.json` - Added MDX files to include array
- `static/app/types/mdx.d.ts` - Created (new file)

## Future Enhancements

Potential improvements that could be made:

1. **Stricter Typing**: Define more specific interfaces for `meta` and `frontMatter` objects
2. **Plugin Types**: Create specific types for remark/rehype plugin data
3. **Component Props**: Define specific prop interfaces for MDX components
4. **Content Validation**: Add runtime validation for frontmatter schemas

## Compatibility

This implementation is compatible with:
- TypeScript 5.8.3+
- React 19.1.0+
- MDX 3.1.0+
- The existing rspack build system
- The current ESLint configuration

No breaking changes were introduced to existing functionality.