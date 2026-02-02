import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import useDismissAlert from 'sentry/utils/useDismissAlert';

import {SDKUpdateAlert} from './sdkUpdateAlert';

jest.mock('sentry/utils/useDismissAlert');

const mockUseDismissAlert = jest.mocked(useDismissAlert);

const organization = OrganizationFixture();

function renderMockRequests({
  projects = [1],
  sdkUpdates = [],
}: {
  projects?: number[];
  sdkUpdates?: Array<{
    projectId: string;
    sdkName: string;
    sdkVersion: string;
    suggestions: Array<{type: string; newSdkVersion?: string}>;
  }>;
} = {}) {
  PageFiltersStore.onInitializeUrlState({
    projects,
    environments: [],
    datetime: {start: null, end: null, period: '14d', utc: null},
  });

  const sdkUpdatesResponse = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/sdk-updates/`,
    body: sdkUpdates,
  });

  return {sdkUpdatesResponse};
}

describe('SDKUpdateAlert', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    mockUseDismissAlert.mockReturnValue({
      dismiss: jest.fn(),
      isDismissed: false,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders alert when SDK update is available for single project', async () => {
    renderMockRequests({
      sdkUpdates: [
        {
          projectId: '1',
          sdkName: 'sentry.javascript.nextjs',
          sdkVersion: '7.0.0',
          suggestions: [{type: 'updateSdk', newSdkVersion: '8.0.0'}],
        },
      ],
    });

    render(<SDKUpdateAlert />, {organization});

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'A newer version of @sentry/nextjs is available. Update to 8.0.0 for the best experience.'
        )
      )
    ).toBeInTheDocument();
  });

  it('renders alert without suggested version', async () => {
    renderMockRequests({
      sdkUpdates: [
        {
          projectId: '1',
          sdkName: 'sentry.python',
          sdkVersion: '1.0.0',
          suggestions: [],
        },
      ],
    });

    render(<SDKUpdateAlert />, {organization});

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'A newer version of sentry-sdk is available. Update to the latest version for the best experience.'
        )
      )
    ).toBeInTheDocument();
  });

  it('does not render when multiple projects are selected', () => {
    renderMockRequests({projects: [1, 2]});

    const {container} = render(<SDKUpdateAlert />, {organization});

    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when no SDK update is needed', async () => {
    const {sdkUpdatesResponse} = renderMockRequests();

    const {container} = render(<SDKUpdateAlert />, {organization});

    await waitFor(() => expect(sdkUpdatesResponse).toHaveBeenCalled());

    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when alert is dismissed', () => {
    mockUseDismissAlert.mockReturnValue({
      dismiss: jest.fn(),
      isDismissed: true,
    });

    const {sdkUpdatesResponse} = renderMockRequests({
      sdkUpdates: [
        {
          projectId: '1',
          sdkName: 'sentry.javascript.react',
          sdkVersion: '7.0.0',
          suggestions: [{type: 'updateSdk', newSdkVersion: '8.0.0'}],
        },
      ],
    });

    expect(sdkUpdatesResponse).not.toHaveBeenCalled();

    const {container} = render(<SDKUpdateAlert />, {organization});

    expect(container).toBeEmptyDOMElement();
  });

  it('calls dismiss when dismiss button is clicked', async () => {
    const dismiss = jest.fn();
    mockUseDismissAlert.mockReturnValue({
      dismiss,
      isDismissed: false,
    });

    renderMockRequests({
      sdkUpdates: [
        {
          projectId: '1',
          sdkName: 'sentry.javascript.node',
          sdkVersion: '7.0.0',
          suggestions: [{type: 'updateSdk', newSdkVersion: '8.0.0'}],
        },
      ],
    });

    render(<SDKUpdateAlert />, {organization});

    const dismissButton = await screen.findByRole('button', {
      name: /Dismiss banner for 30 days/,
    });

    await userEvent.click(dismissButton);

    expect(dismiss).toHaveBeenCalled();
  });
});
