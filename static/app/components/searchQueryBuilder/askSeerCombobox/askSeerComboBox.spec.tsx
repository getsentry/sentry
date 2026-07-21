import {useEffect} from 'react';
import {destroyAnnouncer} from '@react-aria/live-announcer';
import {mutationOptions} from '@tanstack/react-query';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {FeedbackIntegration} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';
import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilderAI,
} from 'sentry/components/searchQueryBuilder/context';
import * as analytics from 'sentry/utils/analytics';
import {fetchMutation} from 'sentry/utils/queryClient';
import {GlobalFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {
  AsyncSDKIntegrationContextProvider,
  useAsyncSDKIntegrationStore,
} from 'sentry/views/app/asyncSDKIntegrationProvider';

const defaultProps = {
  enableAISearch: true,
  filterKeys: {},
  getTagValues: () => Promise.resolve([]),
  initialQuery: 'test',
  searchSource: 'test',
};

const askSeerMutationOptions = mutationOptions({
  mutationFn: async (_value: string) => {
    return fetchMutation<{
      queries: Array<{query: string}>;
      status: string;
      unsupported_reason: string | null;
    }>({
      url: '/organizations/org-slug/trace-explorer-ai/query/',
      method: 'POST',
      data: {},
    });
  },
});

const {organization} = initializeOrg({
  organization: {features: ['gen-ai-features'], hideAiFeatures: false},
});

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

describe('AskSeerComboBox', () => {
  beforeEach(() => {
    // Combobox announcements will pollute the test output if we don't clear them
    destroyAnnouncer();

    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-explorer-ai/setup/',
      method: 'POST',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-explorer-ai/query/',
      method: 'POST',
      body: {status: 'ok', queries: [{query: 'span.duration:>30s'}]},
    });
  });

  it('renders the search input', async () => {
    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <AskSeerComboBox
          initialQuery="test"
          askSeerMutationOptions={askSeerMutationOptions}
          applySeerSearchQuery={() => {}}
        />
      </SearchQueryBuilderProvider>,
      {organization}
    );

    const input = await screen.findByRole('combobox', {
      name: 'Ask Seer with Natural Language',
    });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('test ');
  });

  it('sets the passed initial query as the input value', async () => {
    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <AskSeerComboBox
          initialQuery="test"
          askSeerMutationOptions={askSeerMutationOptions}
          applySeerSearchQuery={() => {}}
        />
      </SearchQueryBuilderProvider>,
      {organization}
    );

    const input = await screen.findByRole('combobox', {
      name: 'Ask Seer with Natural Language',
    });
    expect(input).toHaveValue('test ');
  });

  it('defaults popover to be open', async () => {
    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <AskSeerComboBox
          initialQuery="test"
          askSeerMutationOptions={askSeerMutationOptions}
          applySeerSearchQuery={() => {}}
        />
      </SearchQueryBuilderProvider>,
      {organization}
    );

    const header = await screen.findByText(/Describe what you're looking for./);
    expect(header).toBeInTheDocument();
  });

  it('only shows the reworked footer after results are displayed', async () => {
    const reworkedOrganization = {
      ...organization,
      features: [...organization.features, 'gen-ai-ask-seer-ux-rework'],
    };

    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <AskSeerComboBox
          initialQuery=""
          askSeerMutationOptions={askSeerMutationOptions}
          applySeerSearchQuery={() => {}}
        />
      </SearchQueryBuilderProvider>,
      {organization: reworkedOrganization, additionalWrapper: FeedbackProvider}
    );

    expect(
      await screen.findByText(/Describe what you're looking for./)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Generate again'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Give Feedback'})).not.toBeInTheDocument();

    const input = screen.getByRole('combobox', {
      name: 'Ask Seer with Natural Language',
    });
    await userEvent.type(input, 'test{Enter}');

    const regenerateButton = await screen.findByRole('button', {
      name: 'Generate again',
    });
    expect(regenerateButton).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Give Feedback'})).toBeInTheDocument();

    await userEvent.clear(input);

    expect(regenerateButton).toBeEnabled();
  });

  it('regenerates results when feedback is unavailable', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const queryRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-explorer-ai/query/',
      method: 'POST',
      body: {status: 'ok', queries: [{query: 'span.duration:>30s'}]},
    });
    const reworkedOrganization = {
      ...organization,
      features: [...organization.features, 'gen-ai-ask-seer-ux-rework'],
    };

    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <AskSeerComboBox
          initialQuery=""
          askSeerMutationOptions={askSeerMutationOptions}
          applySeerSearchQuery={() => {}}
        />
      </SearchQueryBuilderProvider>,
      {organization: reworkedOrganization}
    );

    const input = await screen.findByRole('combobox', {
      name: 'Ask Seer with Natural Language',
    });
    await userEvent.type(input, 'test{Enter}');
    await userEvent.clear(input);
    await userEvent.click(await screen.findByRole('button', {name: 'Generate again'}));

    expect(screen.queryByRole('button', {name: 'Give Feedback'})).not.toBeInTheDocument();
    await waitFor(() => expect(queryRequest).toHaveBeenCalledTimes(2));
    expect(trackAnalyticsSpy).toHaveBeenCalledWith('ai_query.regenerated', {
      organization: reworkedOrganization,
      area: '',
      natural_language_query: 'test',
    });
  });

  it('closes seer search when close button is clicked', async () => {
    function TestComponent() {
      const {displayAskSeer, setDisplayAskSeer} = useSearchQueryBuilderAI();
      return displayAskSeer ? (
        <AskSeerComboBox
          initialQuery="test"
          askSeerMutationOptions={askSeerMutationOptions}
          applySeerSearchQuery={() => {}}
        />
      ) : (
        <div>
          <p>Not Seer Search</p>
          <button onClick={() => setDisplayAskSeer(true)}>Open Seer Search</button>
        </div>
      );
    }

    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <TestComponent />
      </SearchQueryBuilderProvider>,
      {organization}
    );

    const openSeerSearchButton = await screen.findByText('Open Seer Search');
    await userEvent.click(openSeerSearchButton);

    const closeButton = await screen.findByRole('button', {
      name: 'Close Seer Search',
    });
    await userEvent.click(closeButton);

    const notSeerSearch = await screen.findByText('Not Seer Search');
    expect(notSeerSearch).toBeInTheDocument();
  });

  it('displays results after user searches', async () => {
    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <AskSeerComboBox
          initialQuery=""
          askSeerMutationOptions={askSeerMutationOptions}
          applySeerSearchQuery={() => {}}
        />
      </SearchQueryBuilderProvider>,
      {organization}
    );

    const input = await screen.findByRole('combobox', {
      name: 'Ask Seer with Natural Language',
    });
    await userEvent.type(input, 'test{Enter}');

    const filter = await screen.findByText('Filter');
    expect(filter).toBeInTheDocument();
    expect(screen.getByText('Do any of these look right to you?')).toBeInTheDocument();
    expect(screen.queryByText('Time Range')).not.toBeInTheDocument();
  });

  it('hides the feedback option when the rework is enabled', async () => {
    const {organization: reworkedOrganization} = initializeOrg({
      organization: {
        features: ['gen-ai-features', 'gen-ai-ask-seer-ux-rework'],
        hideAiFeatures: false,
      },
    });

    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <AskSeerComboBox
          initialQuery=""
          askSeerMutationOptions={askSeerMutationOptions}
          applySeerSearchQuery={() => {}}
        />
      </SearchQueryBuilderProvider>,
      {organization: reworkedOrganization}
    );

    const input = await screen.findByRole('combobox', {
      name: 'Ask Seer with Natural Language',
    });
    await userEvent.type(input, 'test{Enter}');

    expect(await screen.findByText('Filter')).toBeInTheDocument();
    expect(
      screen.queryByText('Do any of these look right to you?')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'None of these'})).not.toBeInTheDocument();
  });

  it('applies the query to the route query params when selected via keyboard', async () => {
    const applySeerSearchQuery = jest.fn();
    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <AskSeerComboBox
          initialQuery=""
          askSeerMutationOptions={askSeerMutationOptions}
          applySeerSearchQuery={applySeerSearchQuery}
        />
      </SearchQueryBuilderProvider>,
      {
        organization,
        initialRouterConfig: {location: {pathname: '/foo/'}},
      }
    );

    const input = await screen.findByRole('combobox', {
      name: 'Ask Seer with Natural Language',
    });
    await userEvent.type(input, 'test{Enter}');

    await userEvent.keyboard('{ArrowDown}{Enter}');

    await waitFor(() =>
      expect(applySeerSearchQuery).toHaveBeenCalledWith({
        key: '0-span.duration:>30s',
        query: 'span.duration:>30s',
      })
    );
  });

  it('renders an error message when the Seer search fails', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-explorer-ai/query/',
      method: 'POST',
      statusCode: 500,
    });

    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <AskSeerComboBox
          initialQuery=""
          askSeerMutationOptions={askSeerMutationOptions}
          applySeerSearchQuery={() => {}}
        />
      </SearchQueryBuilderProvider>,
      {organization}
    );

    const input = await screen.findByRole('combobox', {
      name: 'Ask Seer with Natural Language',
    });
    await userEvent.type(input, 'test{Enter}');

    const errorMessage = await screen.findByText(
      'An error occurred while fetching Seer queries'
    );
    expect(errorMessage).toBeInTheDocument();
  });

  it('does not render if the organization does not have the gen-ai-features feature', () => {
    const {container} = render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <AskSeerComboBox
          initialQuery=""
          askSeerMutationOptions={askSeerMutationOptions}
          applySeerSearchQuery={() => {}}
        />
      </SearchQueryBuilderProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render if the organization has the hideAiFeatures feature', () => {
    const {container} = render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <AskSeerComboBox
          initialQuery=""
          askSeerMutationOptions={askSeerMutationOptions}
          applySeerSearchQuery={() => {}}
        />
      </SearchQueryBuilderProvider>,
      {organization: {...organization, hideAiFeatures: true}}
    );
    expect(container).toBeEmptyDOMElement();
  });
});
