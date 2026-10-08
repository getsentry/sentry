import {RuleTester} from 'oxlint/plugins-dev';

import {preferFakeTimers} from './preferFakeTimers';

const ruleTester = new RuleTester();
const imports = `import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';`;
const wait = `await waitFor(() => expect(ready).toBe(true), {timeout: 1500});`;

ruleTester.run('prefer-fake-timers', preferFakeTimers, {
  valid: [
    `it('spread overrides timeout', async () => { const opts = {timeout: 0}; await waitFor(check, {timeout: 1500, ...opts}); });`,
    `it('computed override is unknown', async () => { await waitFor(check, {timeout: 1500, [option]: 0}); });`,
    `it('last timeout wins', async () => { await waitFor(check, {timeout: 1500, timeout: 0}); });`,
    `it('staged responses have no explicit wait #114733', async () => { MockApiClient.addMockResponse({asyncDelay: 250}); await waitFor(check); });`,
    `it('implicit debounce has no explicit wait #124875', async () => { await userEvent.type(input, 'query'); await screen.findByText('result'); });`,
    `import {jest as clock, test as caseOf, beforeEach as setup} from '@jest/globals'; setup(() => clock.useFakeTimers()); caseOf('import aliases', async () => { ${wait} });`,
    `it('returned bound query', async () => { const {findByText} = render(view); jest.useFakeTimers(); await findByText('ready', {}, {timeout: 1500}); });`,
    `it('scheduled callback', () => { setTimeout(callback, 1500); });`,
    `it('zero sleep', async () => { await new Promise(resolve => setTimeout(resolve, 0)); });`,
    `it('shadowed Promise', async () => { const Promise = custom; await new Promise(resolve => setTimeout(resolve, 1500)); });`,
    `it('shadowed timer', async () => { const setTimeout = custom; await new Promise(resolve => setTimeout(resolve, 1500)); });`,
    `it('fake sleep', async () => { jest.useFakeTimers(); await new Promise(resolve => setTimeout(resolve, 1500)); });`,
    `it('not awaited', () => { new Promise(resolve => setTimeout(resolve, 1500)); });`,
    `it('nested helper', async () => { function helper() { return waitFor(check, {timeout: 1500}); } });`,
    `it('unrelated RTL export', async () => { const x = renderHook(callback); await x.findByText('x', {}, {timeout: 1500}); });`,

    `it('ordinary async', async () => { await waitFor(() => expect(ready).toBe(true)); });`,
    `it('zero timeout', async () => { await waitFor(check, {timeout: 0}); });`,
    `it('unknown timeout', async () => { await waitFor(check, {timeout: external}); });`,
    `it('cyclic constants', async () => { const x = y; const y = x; await waitFor(check, {timeout: x}); });`,
    `it('fake timers', async () => { jest.useFakeTimers(); ${wait} });`,
    `describe('suite', () => { beforeEach(() => jest.useFakeTimers()); it('fake timers', async () => { ${wait} }); });`,
    `beforeAll(() => jest.useFakeTimers()); describe('nested', () => { it('fake timers', async () => { ${wait} }); });`,
    `it('shadowed helper', async () => { const waitFor = custom; ${wait} });`,
    `it('shadowed screen', async () => { const screen = custom; await screen.findByText('ready', {}, {timeout: 1500}); });`,
    `it('query options', async () => { await screen.findByText('ready', {timeout: 1500}); });`,
    `it('unrelated method', async () => { await other.findByText('ready', {}, {timeout: 1500}); });`,
    `function helper() { return waitFor(check, {timeout: 1500}); }`,
    `beforeEach(() => jest.useFakeTimers()); it('late declaration', async () => { ${wait} });`,
    `it('late hook', async () => { ${wait} }); beforeEach(() => jest.useFakeTimers());`,
  ].map(code => ({code: `${imports}\n${code}`})),
  invalid: [
    `it('computed literal timeout', async () => { await waitFor(check, {['timeout']: 1500}); });`,
    `it('last positive timeout wins', async () => { await waitFor(check, {timeout: 0, timeout: 1500}); });`,
    `it('Stripe warning #126038', async () => { await waitFor(check, {timeout: 11000}); });`,
    `it('build polling #108621', async () => { await waitFor(check, {timeout: 12000}); });`,
    `beforeEach(() => jest.useFakeTimers()); it('conditional restore', async () => { if (maybe) jest.useRealTimers(); ${wait} });`,
    `it('sequential query #125099 requires review', async () => { await screen.findByTestId('installs', {}, {timeout: 3000}); });`,
    `it('function helper must not enable', async () => { function helper() { jest.useFakeTimers(); } await waitFor(check, {timeout: 1500}); });`,

    `it('password countdown #126883', async () => { await screen.findByText('Taking you back to sign in (2)…', {}, {timeout: 1500}); });`,
    `it('install retry #126878', async () => { await screen.findByRole('button', {name: 'Retry'}, {timeout: 10_000}); });`,
    `it('workflow polling #126877', async () => { await waitFor(check, {timeout: 7000}); });`,
    `it('find all', async () => { await within(container).findAllByText('ready', {}, {timeout: 1500}); });`,
    `it('render queries', async () => { const {findByText: find} = render(view); await find('ready', {}, {timeout: 1500}); });`,
    `it('constant options', async () => { const duration = 1500; const options = {timeout: duration}; await waitFor(check, options); });`,
    `it('sibling enabled', () => { jest.useFakeTimers(); }); it('real timers', async () => { ${wait} });`,
    `describe('sibling', () => { beforeEach(() => jest.useFakeTimers()); }); it('real timers', async () => { ${wait} });`,
    `it('late enabling', async () => { ${wait} jest.useFakeTimers(); });`,
    `beforeEach(() => jest.useFakeTimers()); it('restored', async () => { jest.useRealTimers(); ${wait} });`,
    `beforeAll(() => jest.useFakeTimers()); beforeEach(() => jest.useRealTimers()); it('restored', async () => { ${wait} });`,
    `beforeEach(() => jest.useRealTimers()); describe('nested', () => { beforeAll(() => jest.useFakeTimers()); it('restored', async () => { ${wait} }); });`,
    `it('conditional enabling', async () => { if (maybe) jest.useFakeTimers(); ${wait} });`,
    `it('uncalled helper', async () => { const enable = () => jest.useFakeTimers(); ${wait} });`,
    `it('shadowed jest', async () => { const jest = custom; jest.useFakeTimers(); ${wait} });`,
    `it.each([1,2])('parameterized', async () => { ${wait} });`,
    `test.only('focused', async () => { ${wait} });`,
  ]
    .map(code => ({
      code: `${imports}\n${code}`,
      errors: [{messageId: 'preferFakeTimers'}],
    }))
    .concat([
      {
        code: `import {waitFor as until} from '@testing-library/react'; it('alias', async () => { await until(check, {timeout: 1500}); });`,
        errors: [{messageId: 'preferFakeTimers'}],
      },
      {
        code: `import * as rtl from '@testing-library/react'; it('namespace', async () => { await rtl.waitFor(check, {timeout: 1500}); });`,
        errors: [{messageId: 'preferFakeTimers'}],
      },
      {
        code: `import {findByText} from '@testing-library/dom'; it('DOM query', async () => { await findByText(container, 'ready', {}, {timeout: 1500}); });`,
        errors: [{messageId: 'preferFakeTimers'}],
      },
      ...[
        `it('disabled polling #126039', async () => { await new Promise(resolve => setTimeout(resolve, 1500)); });`,
        `it('block executor', async () => { await new Promise(resolve => { setTimeout(resolve, 1500); }); });`,
        `it('constant duration', async () => { const duration = 1500; await new Promise(resolve => setTimeout(resolve, duration)); });`,
      ].map(code => ({code, errors: [{messageId: 'sleep'}]})),
    ]),
});
