import {useEffect} from 'react';
import {destroyAnnouncer} from '@react-aria/live-announcer';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {FeedbackIntegration} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';
import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
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

function renderComboBox({
  features,
  hasResults,
}: {
  features: string[];
  hasResults: boolean;
}) {
  const {organization} = initializeOrg({
    organization: {features, hideAiFeatures: false},
  });

  render(
    <SearchQueryBuilderProvider {...defaultProviderProps}>
      <AskSeerComboBox
        applySeerSearchQuery={() => {}}
        isError={false}
        isPending={false}
        queries={hasResults ? [{query: 'span.duration:>30s'}] : []}
        searchQuery=""
        setSearchQuery={() => {}}
        submitQuery={() => {}}
      />
    </SearchQueryBuilderProvider>,
    {organization, additionalWrapper: FeedbackProvider}
  );
}

describe('AskSeerComboBox', () => {
  beforeEach(() => {
    destroyAnnouncer();
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
