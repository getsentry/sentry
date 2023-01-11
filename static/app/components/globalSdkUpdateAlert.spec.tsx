import moment from 'moment';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {InnerGlobalSdkUpdateAlert} from 'sentry/components/globalSdkUpdateAlert';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {PageFilters, ProjectSdkUpdates} from 'sentry/types';
import {DEFAULT_SNOOZE_PROMPT_DAYS} from 'sentry/utils/promptIsDismissed';
import importedUsePageFilters from 'sentry/utils/usePageFilters';

jest.mock('sentry/utils/usePageFilters');

const usePageFilters = importedUsePageFilters as jest.MockedFunction<
  typeof importedUsePageFilters
>;

const makeFilterProps = (
  filters: Partial<PageFilters>
): ReturnType<typeof importedUsePageFilters> => {
  return {
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    selection: {
      projects: [1],
      environments: ['prod'],
      datetime: {start: new Date(), end: new Date(), period: '14d', utc: true},
      ...filters,
    },
  };
};

const makeSdkUpdateProps = (
  sdkUpdateProps: Partial<ProjectSdkUpdates>
): ProjectSdkUpdates[] => {
  return [
    {
      projectId: String(1),
      sdkName: 'sentry-javascript',
      sdkVersion: '1.0.0.',
      suggestions: [
        {
          enables: [],
          newSdkVersion: '1.1.0',
          sdkName: 'sentry-javascript',
          type: 'updateSdk',
        },
      ],
      ...sdkUpdateProps,
    },
  ];
};

describe('GlobalSDKUpdateAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    usePageFilters.mockClear();
  });

  it('does not shows prompt if projects do not match', async () => {
    // We have matching projectId, so updates should be show
    usePageFilters.mockImplementation(() => makeFilterProps({projects: [1]}));
    const sdkUpdates = makeSdkUpdateProps({projectId: String(1)});

    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: undefined,
    };

    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: promptResponse,
    });

    const {rerender} = render(<InnerGlobalSdkUpdateAlert sdkUpdates={sdkUpdates} />, {
      organization: TestStubs.Organization(),
    });

    expect(
      await screen.findByText(/You have outdated SDKs in your projects/)
    ).toBeInTheDocument();

    usePageFilters.mockImplementation(() => makeFilterProps({projects: [2]}));

    // ProjectId no longer matches, so updates should not be shown anymore
    rerender(<InnerGlobalSdkUpdateAlert sdkUpdates={sdkUpdates} />);

    expect(
      screen.queryByText(/You have outdated SDKs in your projects/)
    ).not.toBeInTheDocument();
  });

  it('shows prompt if it has never been dismissed', async () => {
    usePageFilters.mockImplementation(() => makeFilterProps({projects: [0]}));
    const sdkUpdates = makeSdkUpdateProps({projectId: String(0)});
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: undefined,
    };

    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {data: promptResponse},
    });

    render(<InnerGlobalSdkUpdateAlert sdkUpdates={sdkUpdates} />, {
      organization: TestStubs.Organization(),
    });

    expect(
      await screen.findByText(/You have outdated SDKs in your projects/)
    ).toBeInTheDocument();
  });

  it('never shows prompt if it has been dismissed', async () => {
    usePageFilters.mockImplementation(() => makeFilterProps({projects: [0]}));
    const sdkUpdates = makeSdkUpdateProps({projectId: String(0)});
    const promptResponse = {
      dismissed_ts: moment
        .utc()
        .subtract(DEFAULT_SNOOZE_PROMPT_DAYS - 5, 'days')
        .unix(),
      snoozed_ts: undefined,
    };

    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {data: promptResponse},
    });

    render(<InnerGlobalSdkUpdateAlert sdkUpdates={sdkUpdates} />, {
      organization: TestStubs.Organization(),
    });

    await waitFor(() =>
      expect(
        screen.queryByText(/You have outdated SDKs in your projects/)
      ).not.toBeInTheDocument()
    );
  });

  it('shows prompt if snoozed_ts days is longer than threshold', async () => {
    usePageFilters.mockImplementation(() => makeFilterProps({projects: [0]}));
    const sdkUpdates = makeSdkUpdateProps({projectId: String(0)});
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: moment
        .utc()
        .subtract(DEFAULT_SNOOZE_PROMPT_DAYS + 1, 'days')
        .unix(),
    };

    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {data: promptResponse},
    });

    render(<InnerGlobalSdkUpdateAlert sdkUpdates={sdkUpdates} />, {
      organization: TestStubs.Organization(),
    });

    expect(
      await screen.findByText(/You have outdated SDKs in your projects/)
    ).toBeInTheDocument();
  });

  it('shows prompt if snoozed_ts is shorter than threshold', async () => {
    usePageFilters.mockImplementation(() => makeFilterProps({projects: [0]}));
    const sdkUpdates = makeSdkUpdateProps({projectId: String(0)});
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: moment
        .utc()
        .subtract(DEFAULT_SNOOZE_PROMPT_DAYS - 2, 'days')
        .unix(),
    };

    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {data: promptResponse},
    });

    render(<InnerGlobalSdkUpdateAlert sdkUpdates={sdkUpdates} />, {
      organization: TestStubs.Organization(),
    });

    await waitFor(() =>
      expect(
        screen.queryByText(/You have outdated SDKs in your projects/)
      ).not.toBeInTheDocument()
    );
  });

  it('shows prompt for all projects when project matches ALL_ACCESS_PROJECTS', async () => {
    // We intentionally missmatch ALL_ACCESS_PROJECTS with projectId in sdkUpdates
    usePageFilters.mockImplementation(() =>
      makeFilterProps({projects: [ALL_ACCESS_PROJECTS]})
    );
    const sdkUpdates = makeSdkUpdateProps({projectId: String(0)});
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: undefined,
    };

    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: promptResponse,
    });

    render(<InnerGlobalSdkUpdateAlert sdkUpdates={sdkUpdates} />, {
      organization: TestStubs.Organization(),
    });

    expect(
      await screen.findByText(/You have outdated SDKs in your projects/)
    ).toBeInTheDocument();
  });

  it('dimisses prompt', async () => {
    usePageFilters.mockImplementation(() => makeFilterProps({projects: [0]}));
    const sdkUpdates = makeSdkUpdateProps({projectId: String(0)});
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: undefined,
    };

    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {data: promptResponse},
    });

    const promptsActivityMock = MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      method: 'PUT',
    });

    render(<InnerGlobalSdkUpdateAlert sdkUpdates={sdkUpdates} />, {
      organization: TestStubs.Organization(),
    });

    userEvent.click(await screen.findByRole('button', {name: 'Remind me later'}));

    expect(promptsActivityMock).toHaveBeenCalledWith(
      '/prompts-activity/',
      expect.objectContaining({
        data: expect.objectContaining({
          feature: 'sdk_updates',
          organization_id: '3',
        }),
      })
    );

    expect(
      screen.queryByText(/You have outdated SDKs in your projects/)
    ).not.toBeInTheDocument();
  });
});
