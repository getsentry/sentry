import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate, textWithMarkupMatcher} from 'sentry-test/utils';

import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import localStorage from 'sentry/utils/localStorage';

import {LOCAL_STORAGE_KEY, SDKUpdateAlert} from './sdkUpdateAlert';

jest.mock('sentry/utils/localStorage');

const mockGetItem = jest.mocked(localStorage.getItem);
const mockSetItem = jest.mocked(localStorage.setItem);

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

const now = new Date('2020-01-01');

describe('SDKUpdateAlert', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    setMockDate(now);
  });

  afterEach(() => {
    jest.resetAllMocks();
    resetMockDate();
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
          "We've detected you're using the @sentry/nextjs package, and a newer version (8.0.0) is available. Update for a better experience."
        )
      )
    ).toBeInTheDocument();
  });

  it('renders alert with specific package but without suggested version', async () => {
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
          "We've detected you're using the sentry-sdk package, and a newer version is available. Update for a better experience."
        )
      )
    ).toBeInTheDocument();
  });

  it('renders generic alert when SDK name is not recognized', async () => {
    renderMockRequests({
      sdkUpdates: [
        {
          projectId: '1',
          sdkName: 'sentry.unknown.sdk',
          sdkVersion: '1.0.0',
          suggestions: [{type: 'updateSdk', newSdkVersion: '2.0.0'}],
        },
      ],
    });

    render(<SDKUpdateAlert />, {organization});

    expect(
      await screen.findByText(
        'A newer version of the Sentry SDK is available. Update for a better experience.'
      )
    ).toBeInTheDocument();
  });

  it('does not render when multiple projects are selected', () => {
    renderMockRequests({projects: [1, 2]});

    const {container} = render(<SDKUpdateAlert />, {organization});

    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when "All Projects" is selected', () => {
    renderMockRequests({projects: [ALL_ACCESS_PROJECTS]});

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
    mockGetItem.mockImplementation(key => {
      if (key === LOCAL_STORAGE_KEY) {
        return JSON.stringify(now.getTime().toString());
      }
      return null;
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

  it('dismisses alert and saves to localStorage when dismiss button is clicked', async () => {
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

    await waitFor(() =>
      expect(mockSetItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEY,
        JSON.stringify(now.getTime().toString())
      )
    );

    expect(
      screen.queryByRole('button', {name: /Dismiss banner for 30 days/})
    ).not.toBeInTheDocument();
  });
});
