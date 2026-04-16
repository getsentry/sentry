import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {bitbucketIntegrationPipeline} from './pipelineIntegrationBitbucket';
import type {PipelineStepProps} from './types';

const BitbucketAuthorizeStep = bitbucketIntegrationPipeline.steps[0].component;

function makeStepProps<D, A>(
  overrides: Partial<PipelineStepProps<D, A>> & {stepData: D}
): PipelineStepProps<D, A> {
  return {
    advance: jest.fn(),
    advanceError: null,
    isAdvancing: false,
    stepIndex: 0,
    totalSteps: 1,
    ...overrides,
  };
}

let mockPopup: Window;

function dispatchPipelineMessage({
  data,
  origin = document.location.origin,
  source = mockPopup,
}: {
  data: Record<string, string>;
  origin?: string;
  source?: Window | MessageEventSource | null;
}) {
  act(() => {
    const event = new MessageEvent('message', {data, origin});
    Object.defineProperty(event, 'source', {value: source});
    window.dispatchEvent(event);
  });
}

beforeEach(() => {
  mockPopup = {
    closed: false,
    close: jest.fn(),
    focus: jest.fn(),
  } as unknown as Window;
  jest.spyOn(window, 'open').mockReturnValue(mockPopup);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BitbucketAuthorizeStep', () => {
  it('renders the authorize button', () => {
    render(
      <BitbucketAuthorizeStep
        {...makeStepProps({
          stepData: {
            authorizeUrl:
              'https://bitbucket.org/site/addons/authorize?descriptor_uri=test',
          },
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorize Bitbucket'})).toBeInTheDocument();
  });

  it('calls advance with JWT on callback', async () => {
    const advance = jest.fn();
    render(
      <BitbucketAuthorizeStep
        {...makeStepProps({
          stepData: {
            authorizeUrl:
              'https://bitbucket.org/site/addons/authorize?descriptor_uri=test',
          },
          advance,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize Bitbucket'}));

    dispatchPipelineMessage({
      data: {
        _pipeline_source: 'sentry-pipeline',
        jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      },
    });

    expect(advance).toHaveBeenCalledWith({
      jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
    });
  });

  it('shows reopen button when waiting for callback', async () => {
    render(
      <BitbucketAuthorizeStep
        {...makeStepProps({
          stepData: {
            authorizeUrl:
              'https://bitbucket.org/site/addons/authorize?descriptor_uri=test',
          },
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize Bitbucket'}));

    expect(
      screen.getByRole('button', {name: 'Reopen authorization window'})
    ).toBeInTheDocument();
  });

  it('shows loading state when isAdvancing is true', () => {
    render(
      <BitbucketAuthorizeStep
        {...makeStepProps({
          stepData: {
            authorizeUrl:
              'https://bitbucket.org/site/addons/authorize?descriptor_uri=test',
          },
          isAdvancing: true,
        })}
      />
    );

    expect(screen.getByRole('button', {name: 'Authorizing...'})).toBeDisabled();
  });

  it('disables authorize button when authorizeUrl is not provided', () => {
    render(<BitbucketAuthorizeStep {...makeStepProps({stepData: {}})} />);

    expect(screen.getByRole('button', {name: 'Authorize Bitbucket'})).toBeDisabled();
  });

  it('shows popup blocked notice when popup fails to open', async () => {
    jest.spyOn(window, 'open').mockReturnValue(null);
    render(
      <BitbucketAuthorizeStep
        {...makeStepProps({
          stepData: {
            authorizeUrl:
              'https://bitbucket.org/site/addons/authorize?descriptor_uri=test',
          },
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Authorize Bitbucket'}));

    expect(screen.getByText(/authorization popup was blocked/)).toBeInTheDocument();
  });
});
