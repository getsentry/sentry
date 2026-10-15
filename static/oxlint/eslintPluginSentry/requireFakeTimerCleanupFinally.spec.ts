import {RuleTester} from 'oxlint/plugins-dev';

import {requireFakeTimerCleanup} from './requireFakeTimerCleanup';

const ruleTester = new RuleTester();

ruleTester.run('require-fake-timer-cleanup', requireFakeTimerCleanup, {
  valid: [
    {
      name: 'pending timers flushed in an initializer before finally restoration',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {const flushed = jest.runOnlyPendingTimers();} finally {jest.useRealTimers();}});`,
    },
    {
      name: 'uncalled function declarations do not restore timers',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {function restore() {jest.useRealTimers();} const deferred = () => jest.useRealTimers(); jest.runOnlyPendingTimers();} finally {jest.useRealTimers();}});`,
    },
    {
      name: 'finally restores timers after synchronous cleanup',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {cleanup(); jest.runOnlyPendingTimers();} finally {jest.useRealTimers(); jest.restoreAllMocks();}});`,
    },
    {
      name: 'finally restores timers after awaited asynchronous cleanup',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(async () => {try {cleanup(); await jest.runOnlyPendingTimersAsync();} finally {jest.useRealTimers();}});`,
    },
    {
      name: 'finally restores timers after synchronous act cleanup',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {cleanup(); act(() => {jest.runOnlyPendingTimers();});} finally {jest.useRealTimers();}});`,
    },
    {
      name: 'finally restores timers after awaited asynchronous act cleanup',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(async () => {try {cleanup(); await act(async () => {await jest.runOnlyPendingTimersAsync();});} finally {jest.useRealTimers();}});`,
    },
  ],
  invalid: [
    {
      name: 'finally restoration still requires a flush',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {cleanup();} finally {jest.useRealTimers();}});`,
      errors: [{messageId: 'missingRunOnlyPendingTimers'}],
    },
    {
      name: 'unawaited asynchronous flush in try does not count',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {jest.runOnlyPendingTimersAsync();} finally {jest.useRealTimers();}});`,
      errors: [{messageId: 'missingRunOnlyPendingTimers'}],
    },
    {
      name: 'unawaited asynchronous act in try does not count',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {act(async () => {await jest.runOnlyPendingTimersAsync();});} finally {jest.useRealTimers();}});`,
      errors: [{messageId: 'missingRunOnlyPendingTimers'}],
    },
    {
      name: 'restore before flush in try does not count',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {jest.useRealTimers(); jest.runOnlyPendingTimers();} finally {jest.useRealTimers();}});`,
      errors: [{messageId: 'missingRunOnlyPendingTimers'}],
    },
    {
      name: 'restore in a variable initializer before flush does not count',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {const restored = jest.useRealTimers(); jest.runOnlyPendingTimers();} finally {jest.useRealTimers();}});`,
      errors: [{messageId: 'missingRunOnlyPendingTimers'}],
    },
    {
      name: 'restore in an awaited initializer before flush does not count',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(async () => {try {const restored = await jest.useRealTimers(); await jest.runOnlyPendingTimersAsync();} finally {jest.useRealTimers();}});`,
      errors: [{messageId: 'missingRunOnlyPendingTimers'}],
    },
    {
      name: 'conditional flush in try does not count',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {if (condition) jest.runOnlyPendingTimers();} finally {jest.useRealTimers();}});`,
      errors: [{messageId: 'missingCleanup'}],
    },
    {
      name: 'early return in try does not count',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {return; jest.runOnlyPendingTimers();} finally {jest.useRealTimers();}});`,
      errors: [{messageId: 'missingCleanup'}],
    },
    {
      name: 'throw before flush in try does not count',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {throw new Error(); jest.runOnlyPendingTimers();} finally {jest.useRealTimers();}});`,
      errors: [{messageId: 'missingCleanup'}],
    },
    {
      name: 'catch cleanup is not proven',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {cleanup();} catch (error) {jest.runOnlyPendingTimers();} finally {jest.useRealTimers();}});`,
      errors: [{messageId: 'missingCleanup'}],
    },
    {
      name: 'conditional restore in finally does not count',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {jest.runOnlyPendingTimers();} finally {if (condition) jest.useRealTimers();}});`,
      errors: [{messageId: 'missingCleanup'}],
    },
    {
      name: 'fallible cleanup before restoration in finally is not proven',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {jest.runOnlyPendingTimers();} finally {cleanup(); jest.useRealTimers();}});`,
      errors: [{messageId: 'missingCleanup'}],
    },
    {
      name: 'try without finally does not count',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {try {jest.runOnlyPendingTimers(); jest.useRealTimers();} catch (error) {}});`,
      errors: [{messageId: 'missingCleanup'}],
    },
  ],
});
