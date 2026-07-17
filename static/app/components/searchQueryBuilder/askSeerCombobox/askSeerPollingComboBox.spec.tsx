import {useEffect} from 'react';
import {destroyAnnouncer} from '@react-aria/live-announcer';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {FeedbackIntegration} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';
import {AskSeerPollingComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerPollingComboBox';
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

function renderPollingComboBox(features: string[], withFeedback = true) {
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

  it('preserves the existing loading experience when the rework is disabled', async () => {
    renderPollingComboBox(['gen-ai-features']);
    await submitQuery();

    expect(await screen.findByText("I'm on it...")).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Give Feedback'})).toBeInTheDocument();
  });

  it('shows the single loading status when the rework is enabled', async () => {
    renderPollingComboBox(['gen-ai-features', 'gen-ai-ask-seer-ux-rework']);
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
    const {organization} = renderPollingComboBox(
      ['gen-ai-features', 'gen-ai-ask-seer-ux-rework'],
      false
    );

    await submitQuery();
    const regenerateButton = await screen.findByRole('button', {
      name: 'Generate again',
    });
    expect(regenerateButton).toBeEnabled();

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
});
