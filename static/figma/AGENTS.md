# Sentry Scraps Figma Code Connect

This directory contains [Code Connect]() files for the `@sentry/scraps` design system. Code Connect is a tool that connects your design system components in code with your design system in Figma.

## Requirements

- If the Figma MCP is not connected, STOP and prompt the user to enable the Figma MCP via Figma's Dev Mode.
- All files in this directory MUST use the `*.figma.tsx` extension
- All files in this directory MUST include a `figma.connect()` call. See file template below.
- All imports from the design system should use the `@sentry/scraps` specifier, which is an alias for `static/app/components/core/*`

## File Template

```tsx
import figma from '@figma/code-connect';

import {ComponentName, type ComponentProps} from '@sentry/scraps/component-name';

import {figmaNodeUrl} from './utils';

figma.connect(
  ComponentName,
  // direct link to Figma component using Figma node-id
  figmaNodeUrl('6943-13522'),
  {
    props: {
      // mapping from React props -> Figma control
      variant: figma.enum('Variant', {
        Primary: 'primary',
      }),
      // No matching props could be found for these Figma properties:
      // showLink: figma.boolean("Show Link")
    } satisfies ComponentProps,
    example: props => (
      // JSX example with explicit prop passing
      // Avoid using {...props}
      <ComponentName type={props.type} />
    ),
    links: [
      {
        name: 'Storybook',
        url: 'https://sentry.sentry.io/stories/core/component-name',
      },
    ],
  }
);
```
