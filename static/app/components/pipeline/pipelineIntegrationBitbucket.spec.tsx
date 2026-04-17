import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {bitbucketIntegrationPipeline} from './pipelineIntegrationBitbucket';
import {createMakeStepProps, dispatchPipelineMessage, setupMockPopup} from './testUtils';

const BitbucketAuthorizeStep = bitbucketIntegrationPipeline.steps[0].component;

const makeStepProps = createMakeStepProps({totalSteps: 1});

let mockPopup: Window;

beforeEach(() => {
  mockPopup = setupMockPopup();
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
      source: mockPopup,
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
