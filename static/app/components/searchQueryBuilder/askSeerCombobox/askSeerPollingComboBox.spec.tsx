import {useEffect, useState} from 'react';
import {destroyAnnouncer} from '@react-aria/live-announcer';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {FeedbackIntegration} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {AskSeerPollingComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerPollingComboBox';
import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilderAI,
} from 'sentry/components/searchQueryBuilder/context';
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
  createForm: jest.fn(),
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

function renderPollingComboBox(withFeedback = true) {
  const {organization} = initializeOrg({
    organization: {features: ['gen-ai-features'], hideAiFeatures: false},
  });

  render(
    <SearchQueryBuilderProvider {...defaultProviderProps}>
      <AskSeerPollingComboBox
        initialQuery=""
        projectIds={[]}
        strategy="Traces"
        applySeerSearchQuery={() => {}}
      />
    </SearchQueryBuilderProvider>,
    withFeedback ? {organization, additionalWrapper: FeedbackProvider} : {organization}
  );

  return {organization};
}

async function submitQuery() {
  const input = await screen.findByRole('combobox', {
    name: 'Ask Seer with Natural Language',
  });
  await userEvent.type(input, 'find slow spans{Enter}');
}

describe('AskSeerPollingComboBox loading state', () => {
  beforeEach(() => {
    destroyAnnouncer();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/search-agent/start/',
      method: 'POST',
      body: new Promise(() => {}),
    });
  });

  it('shows the loading status', async () => {
    renderPollingComboBox();
    await submitQuery();

    expect(await screen.findByRole('status')).toHaveTextContent("I'm on it...");
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Give Feedback'})).not.toBeInTheDocument();
  });
});

describe('AskSeerPollingComboBox results', () => {
  beforeEach(() => {
    destroyAnnouncer();
    MockApiClient.clearMockResponses();
  });

  it('regenerates results when feedback is unavailable', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const startRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/search-agent/start/',
      method: 'POST',
      body: {run_id: 123},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/search-agent/state/123/',
      body: {
        session: {
          status: 'completed',
          current_step: null,
          completed_steps: [],
          final_response: {query: 'span.duration:>30s'},
        },
      },
    });
    const {organization} = renderPollingComboBox(false);

    await submitQuery();
    const regenerateButton = await screen.findByRole('button', {
      name: 'Generate again',
    });
    expect(regenerateButton).toBeEnabled();
    expect(screen.getByText('Filter')).toBeInTheDocument();
    expect(
      screen.queryByText('Do any of these look right to you?')
    ).not.toBeInTheDocument();

    const input = screen.getByRole('combobox', {
      name: 'Ask Seer with Natural Language',
    });
    await userEvent.clear(input);
    expect(regenerateButton).toBeEnabled();

    await userEvent.click(regenerateButton);

    expect(screen.queryByRole('button', {name: 'Give Feedback'})).not.toBeInTheDocument();
    expect(startRequest).toHaveBeenCalledTimes(2);
    expect(trackAnalyticsSpy).toHaveBeenCalledWith('ai_query.regenerated', {
      organization,
      area: '',
      natural_language_query: 'find slow spans',
    });
  });

  it('shows result feedback in the footer', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/search-agent/start/',
      method: 'POST',
      body: {run_id: 123},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/search-agent/state/123/',
      body: {
        session: {
          status: 'completed',
          current_step: null,
          completed_steps: [],
          final_response: {query: 'span.duration:>30s'},
        },
      },
    });
    renderPollingComboBox();

    await submitQuery();

    expect(await screen.findByText('How did we do?')).toBeInTheDocument();
    expect(
      screen.queryByText('We loaded the results. Does this look right?')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Generate again'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: /Query parameters:/})).toBeInTheDocument();
  });

  it('does not autofocus the query builder after applying a selected query', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/search-agent/start/',
      method: 'POST',
      body: {run_id: 123},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/search-agent/state/123/',
      body: {
        session: {
          status: 'completed',
          current_step: null,
          completed_steps: [],
          final_response: {query: 'span.duration:>30s'},
        },
      },
    });
    const {organization} = initializeOrg({
      organization: {
        features: ['gen-ai-features'],
        hideAiFeatures: false,
      },
    });

    function TestComponent() {
      const [query, setQuery] = useState('');
      const {displayAskSeer, setDisplayAskSeer} = useSearchQueryBuilderAI();

      useEffect(() => {
        setDisplayAskSeer(true);
      }, [setDisplayAskSeer]);

      if (displayAskSeer) {
        return (
          <AskSeerPollingComboBox
            initialQuery=""
            projectIds={[]}
            strategy="Traces"
            applySeerSearchQuery={item => setQuery(item.query ?? '')}
          />
        );
      }

      return (
        <SearchQueryBuilder {...defaultProviderProps} autoFocus initialQuery={query} />
      );
    }

    render(
      <SearchQueryBuilderProvider {...defaultProviderProps}>
        <TestComponent />
      </SearchQueryBuilderProvider>,
      {organization}
    );

    await submitQuery();
    await screen.findByRole('option', {name: /^Query parameters:/});
    await userEvent.keyboard('{ArrowDown}{Enter}');

    const queryBuilderInputs = await screen.findAllByRole('combobox', {
      name: 'Add a search term',
    });
    expect(queryBuilderInputs).not.toContain(document.activeElement);
    expect(screen.getByRole('grid')).not.toHaveFocus();
  });
});

describe('AskSeerPollingComboBox error state', () => {
  beforeEach(() => {
    destroyAnnouncer();
    MockApiClient.clearMockResponses();
  });

  it('renders the error actions and retries the failed search', async () => {
    const startRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/search-agent/start/',
      method: 'POST',
      body: {run_id: 123},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/search-agent/state/123/',
      body: {
        session: {
          status: 'error',
          current_step: null,
          completed_steps: [],
        },
      },
    });
    renderPollingComboBox();

    await submitQuery();

    expect(
      await screen.findByText('Seer failed to process your search. Please try again.')
    ).toBeInTheDocument();
    expect(screen.getByRole('img', {name: 'Error'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Give Feedback'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Try again'}));

    await waitFor(() => expect(startRequest).toHaveBeenCalledTimes(2));
  });
});
