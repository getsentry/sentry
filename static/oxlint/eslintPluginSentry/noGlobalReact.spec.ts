import {RuleTester} from 'oxlint/plugins-dev';

import {noGlobalReact} from './noGlobalReact';

const ruleTester = new RuleTester();

ruleTester.run('no-global-react', noGlobalReact, {
  valid: [
    {
      code: "import type * as React from 'react'; export type Props = {children: React.ReactNode};",
      filename: 'component.tsx',
    },
    {
      code: "import type React from 'react'; export type Props = {children: React.ReactNode};",
      filename: 'component.tsx',
    },
    {
      code: "import type {ReactNode} from 'react'; export type Props = {children: ReactNode};",
      filename: 'component.tsx',
    },
    {
      code: "import * as React from 'react'; export const element = React.createElement('div');",
      filename: 'component.tsx',
    },
    {
      code: "import React from 'react'; export const element = <React.StrictMode />;",
      filename: 'component.tsx',
    },
    {
      code: "export type Node = React.ReactNode; import type * as React from 'react';",
      filename: 'component.tsx',
    },
    {
      code: 'export function example(React: {value: string}) { return React.value; }',
      filename: 'component.tsx',
    },
    {
      code: 'export type Props = {React: string};',
      filename: 'component.tsx',
    },
    {
      code: "import * as React from 'react'; export type Module = typeof React;",
      filename: 'component.tsx',
    },
    {
      code: 'namespace React { export type ReactNode = string; } export type Node = React.ReactNode;',
      filename: 'component.tsx',
    },
    {
      code: "import type * as React from 'react'; export type Node = React.ReactNode;",
      filename: 'component.tsx',
      languageOptions: {globals: {React: 'readonly'}},
    },
  ],
  invalid: [
    {
      code: 'export interface Props extends React.HTMLAttributes<HTMLDivElement> {}',
      filename: 'component.tsx',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'export type Props = {children: React.ReactNode};',
      filename: 'component.tsx',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'export type Props = React.JSX.IntrinsicElements;',
      filename: 'component.tsx',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: "import 'react'; export type Node = React.ReactNode;",
      filename: 'component.tsx',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: "import * as UI from 'react'; export type Node = React.ReactNode;",
      filename: 'component.tsx',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: "export const element = React.createElement('div');",
      filename: 'component.tsx',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'export const element = <React.StrictMode />;',
      filename: 'component.tsx',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'export type Module = typeof React;',
      filename: 'component.tsx',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'function local(React: unknown) { return React; } export type Node = React.ReactNode;',
      filename: 'component.tsx',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'export type Node = React.ReactNode;',
      filename: 'component.tsx',
      languageOptions: {globals: {React: 'readonly'}},
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'export const react = React;',
      filename: 'component.tsx',
      errors: [{messageId: 'forbidden'}],
    },
  ],
});
