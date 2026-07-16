import {useEffect} from 'react';
import {destroyAnnouncer} from '@react-aria/live-announcer';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {FeedbackIntegration} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';
import {AskSeerPollingComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerPollingComboBox';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
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

function renderPollingComboBox(features: string[]) {
  const {organization} = initializeOrg({
    organization: {features, hideAiFeatures: false},
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
    {organization, additionalWrapper: FeedbackProvider}
  );
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

  it('shows the existing loading experience with the feedback footer when the rework is disabled', async () => {
    renderPollingComboBox(['gen-ai-features']);
    await submitQuery();

    expect(await screen.findByText("I'm on it...")).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Give Feedback'})).toBeInTheDocument();
  });

  it('shows the single loading status without the feedback footer when the rework is enabled', async () => {
    renderPollingComboBox(['gen-ai-features', 'gen-ai-ask-seer-ux-rework']);
    await submitQuery();

    expect(await screen.findByRole('status')).toHaveTextContent("I'm on it...");
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Give Feedback'})).not.toBeInTheDocument();
  });

  it('shows the feedback footer when displaying results', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/search-agent/start/',
      method: 'POST',
      body: {run_id: 1},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/search-agent/state/1/',
      body: {
        session: {
          completed_steps: [],
          created_at: '2026-01-01T00:00:00Z',
          current_step: null,
          final_response: {query: 'span.duration:>30s'},
          natural_language_query: 'find slow spans',
          org_id: 1,
          org_slug: 'org-slug',
          run_id: 1,
          status: 'completed',
          strategy: 'Traces',
          updated_at: '2026-01-01T00:00:00Z',
        },
      },
    });

    renderPollingComboBox(['gen-ai-features', 'gen-ai-ask-seer-ux-rework']);
    await submitQuery();

    expect(
      await screen.findByText('Do any of these look right to you?')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Give Feedback'})).toBeInTheDocument();
  });
});
