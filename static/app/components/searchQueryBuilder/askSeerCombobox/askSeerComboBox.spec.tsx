import {useEffect, useState} from 'react';
import {destroyAnnouncer} from '@react-aria/live-announcer';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {FeedbackIntegration} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';
import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import * as analytics from 'sentry/utils/analytics';
import {GlobalFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {
  AsyncSDKIntegrationContextProvider,
  useAsyncSDKIntegrationStore,
} from 'sentry/views/app/asyncSDKIntegrationProvider';

const defaultProviderProps = {
  enableAISearch: true,
  filterKeys: {},
  getTagValues: () => Promise.resolve([]),
  initialQuery: '',
  searchSource: 'test',
};

const feedbackIntegration = {
  createForm: jest.fn(() => ({
    appendToDom: jest.fn(),
    open: jest.fn(),
  })),
} as unknown as FeedbackIntegration;

function FeedbackProvider({children}: {children: React.ReactNode}) {
  return (
    <AsyncSDKIntegrationContextProvider>
      <InstallFeedbackIntegration />
      <GlobalFeedbackForm>{children}</GlobalFeedbackForm>
    </AsyncSDKIntegrationContextProvider>
  );
}

function InstallFeedbackIntegration() {
  const {setState} = useAsyncSDKIntegrationStore();

  useEffect(() => {
    setState({Feedback: feedbackIntegration});
  }, [setState]);

  return null;
}

function StatefulComboBox({
  hasResults,
  isError,
}: {
  hasResults: boolean;
  isError: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <AskSeerComboBox
      applySeerSearchQuery={() => {}}
      isError={isError}
      isPending={false}
      queries={hasResults ? [{query: 'span.duration:>30s'}] : []}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      submitQuery={() => {}}
    />
  );
}

function renderComboBox({
  features,
  hasResults,
  isError = false,
}: {
  features: string[];
  hasResults: boolean;
  isError?: boolean;
}) {
  const {organization} = initializeOrg({
    organization: {features, hideAiFeatures: false},
  });

  return render(
    <SearchQueryBuilderProvider {...defaultProviderProps}>
      <StatefulComboBox hasResults={hasResults} isError={isError} />
    </SearchQueryBuilderProvider>,
    {organization, additionalWrapper: FeedbackProvider}
  );
}

describe('AskSeerComboBox', () => {
  beforeEach(() => {
    destroyAnnouncer();
    jest.restoreAllMocks();
  });

  it('always displays the feedback button when the rework is disabled', async () => {
    renderComboBox({features: ['gen-ai-features'], hasResults: false});

    expect(
      await screen.findByRole('button', {name: 'Give Feedback'})
    ).toBeInTheDocument();
  });

  it('only displays the feedback button with results when the rework is enabled', async () => {
    renderComboBox({
      features: ['gen-ai-features', 'gen-ai-ask-seer-ux-rework'],
      hasResults: false,
    });

    expect(
      await screen.findByText("Describe what you're looking for.")
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Give Feedback'})).not.toBeInTheDocument();
  });

  it('tracks a query submission once', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    renderComboBox({features: ['gen-ai-features'], hasResults: false});

    const input = await screen.findByRole('combobox', {
      name: 'Ask Seer with Natural Language',
    });
    await userEvent.type(input, 'find slow spans{Enter}');

    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'ai_query.submitted',
      expect.objectContaining({
        area: '',
        natural_language_query: 'find slow spans',
      })
    );
    expect(trackAnalyticsSpy).toHaveBeenCalledTimes(1);
  });

  it('tracks a rejected query once', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    renderComboBox({features: ['gen-ai-features'], hasResults: true});

    const input = await screen.findByRole('combobox', {
      name: 'Ask Seer with Natural Language',
    });
    await userEvent.type(input, '{ArrowDown}{ArrowDown}{Enter}');

    const rejectedEvents = trackAnalyticsSpy.mock.calls.filter(
      ([eventKey]) => eventKey === 'ai_query.rejected'
    );
    expect(rejectedEvents).toEqual([
      [
        'ai_query.rejected',
        expect.objectContaining({
          area: '',
          natural_language_query: '',
          num_queries_returned: 1,
        }),
      ],
    ]);
  });

  it('tracks each rendered error once', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const {rerender} = renderComboBox({
      features: ['gen-ai-features'],
      hasResults: false,
      isError: true,
    });

    expect(
      await screen.findByText('An error occurred while fetching Seer queries')
    ).toBeInTheDocument();
    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'ai_query.error',
      expect.objectContaining({
        area: '',
        natural_language_query: '',
        is_fetch: undefined,
        status_code: undefined,
      })
    );
    expect(trackAnalyticsSpy).toHaveBeenCalledTimes(1);

    rerender(
      <SearchQueryBuilderProvider {...defaultProviderProps}>
        <StatefulComboBox hasResults={false} isError />
      </SearchQueryBuilderProvider>
    );

    expect(trackAnalyticsSpy).toHaveBeenCalledTimes(1);
  });

  it('displays the feedback button with results when the rework is enabled', async () => {
    renderComboBox({
      features: ['gen-ai-features', 'gen-ai-ask-seer-ux-rework'],
      hasResults: true,
    });

    expect(
      await screen.findByRole('button', {name: 'Give Feedback'})
    ).toBeInTheDocument();
  });
});
