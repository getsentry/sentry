import {RuleTester} from 'oxlint/plugins-dev';

import {noShadowDangerousGlobals} from './noShadowDangerousGlobals';

const ruleTester = new RuleTester();

ruleTester.run('no-shadow-dangerous-globals', noShadowDangerousGlobals, {
  valid: [
    {code: 'export type URL = string;', filename: 'file.ts'},
    {code: 'export interface Window {sentry: string}', filename: 'file.ts'},
    {
      code: "import type {URL} from 'url'; import {type Promise} from 'promise';",
      filename: 'file.ts',
    },
    {code: "export enum Fields { URL = 'url' }", filename: 'file.ts'},
    {
      code: 'export const api = {fetch: () => 1, window: 2}; export class Api { fetch() {} window = 1; }',
      filename: 'file.ts',
    },
    {
      code: 'export const element = <Chart window={1} setInterval={() => {}} />;',
      filename: 'component.tsx',
    },
    {
      code: "jest.spyOn(window, 'fetch'); fetch('/api/'); window.setTimeout(() => {}, 1);",
      filename: 'file.spec.ts',
    },
    {code: 'export const location = 1; export const event = 2;', filename: 'file.ts'},
  ],
  invalid: [
    {
      code: 'export function fetch() {}',
      filename: 'file.ts',
      errors: [{messageId: 'shadowed', data: {name: 'fetch'}}],
    },
    {
      code: 'export class Promise {}',
      filename: 'file.ts',
      errors: [{messageId: 'shadowed', data: {name: 'Promise'}}],
    },
    {
      code: 'export const Number = styled("span")``;',
      filename: 'file.ts',
      errors: [{messageId: 'shadowed', data: {name: 'Number'}}],
    },
    {
      code: 'export function poll(setTimeout: number, {window}: {window: number}) { return setTimeout + window; }',
      filename: 'file.ts',
      errors: [
        {messageId: 'shadowed', data: {name: 'setTimeout'}},
        {messageId: 'shadowed', data: {name: 'window'}},
      ],
    },
    {
      code: 'export function Chart() { const [interval, setInterval] = useState(1); return {interval, setInterval}; }',
      filename: 'file.ts',
      errors: [{messageId: 'shadowed', data: {name: 'setInterval'}}],
    },
    {
      code: "import {localStorageWrapper as localStorage} from 'storage'; import JSON from 'json'; import * as Math from 'math';",
      filename: 'file.ts',
      errors: [
        {messageId: 'shadowed', data: {name: 'localStorage'}},
        {messageId: 'shadowed', data: {name: 'JSON'}},
        {messageId: 'shadowed', data: {name: 'Math'}},
      ],
    },
    {
      code: 'try { run(); } catch (Error) { report(Error); }',
      filename: 'file.ts',
      errors: [{messageId: 'shadowed', data: {name: 'Error'}}],
    },
    {
      code: "export enum URL { Api = 'api' } export namespace Symbol { export const key = 1; }",
      filename: 'file.ts',
      errors: [
        {messageId: 'shadowed', data: {name: 'URL'}},
        {messageId: 'shadowed', data: {name: 'Symbol'}},
      ],
    },
  ],
});
