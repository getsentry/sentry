import {act} from 'react';

import type {PipelineStepProps} from './types';

/**
 * Creates a makeStepProps helper pre-filled with pipeline-specific defaults.
 *
 * Call once at the top of a describe block:
 *
 *   const makeStepProps = createMakeStepProps({totalSteps: 2});
 *
 * Then use in each test:
 *
 *   makeStepProps({stepData: {...}})
 */
export function createMakeStepProps(
  defaults: Partial<PipelineStepProps<any, any>> & {totalSteps: number}
) {
  return function makeStepProps<D, A>(
    overrides: Partial<PipelineStepProps<D, A>> & {stepData: D}
  ): PipelineStepProps<D, A> {
    return {
      advance: jest.fn(),
      advanceError: null,
      isAdvancing: false,
      isInitializing: false,
      stepIndex: 0,
      ...defaults,
      ...overrides,
    };
  };
}

/**
 * Sets up a mock popup window and spies on window.open to return it.
 * Call in beforeEach. Remember to call jest.restoreAllMocks() in afterEach.
 */
export function setupMockPopup(): Window {
  const popup = {
    closed: false,
    close: jest.fn(),
    focus: jest.fn(),
  } as unknown as Window;
  jest.spyOn(window, 'open').mockReturnValue(popup);
  return popup;
}

/**
 * Dispatches a MessageEvent simulating a pipeline popup callback.
 */
export function dispatchPipelineMessage({
  data,
  origin = document.location.origin,
  source,
}: {
  data: Record<string, string>;
  source: Window | MessageEventSource | null;
  origin?: string;
}) {
  act(() => {
    const event = new MessageEvent('message', {data, origin});
    Object.defineProperty(event, 'source', {value: source});
    window.dispatchEvent(event);
  });
}
