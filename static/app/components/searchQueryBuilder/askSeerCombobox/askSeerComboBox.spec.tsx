import {destroyAnnouncer} from '@react-aria/live-announcer';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilder,
} from 'sentry/components/searchQueryBuilder/context';
import {fetchMutation, mutationOptions} from 'sentry/utils/queryClient';

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
      url: `/organizations/org-slug/trace-explorer-ai/query/`,
      method: 'POST',
      data: {},
    });
  },
});

const {organization} = initializeOrg({
  organization: {features: ['gen-ai-features'], hideAiFeatures: false},
});

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

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      method: 'GET',
      body: {setupAcknowledgement: {orgHasAcknowledged: true, userHasAcknowledged: true}},
    });
  });

  it('renders the search input', async () => {
    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <AskSeerComboBox
          initialQuery="test"
          askSeerMutationOptions={askSeerMutationOptions}
          applySeerSearchQuery={() => {}}
          analyticsSource="test"
          feedbackSource="test"
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
          analyticsSource="test"
          feedbackSource="test"
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
          analyticsSource="test"
          feedbackSource="test"
        />
      </SearchQueryBuilderProvider>,
      {organization}
    );

    const header = await screen.findByText(/Describe what you're looking for./);
    expect(header).toBeInTheDocument();
  });

  it('closes seer search when close button is clicked', async () => {
    function TestComponent() {
      const {displayAskSeer, setDisplayAskSeer} = useSearchQueryBuilder();
      return displayAskSeer ? (
        <AskSeerComboBox
          initialQuery="test"
          askSeerMutationOptions={askSeerMutationOptions}
          applySeerSearchQuery={() => {}}
          analyticsSource="test"
          feedbackSource="test"
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
          analyticsSource="test"
          feedbackSource="test"
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
  });

  it('applies the query to the route query params when selected via keyboard', async () => {
    const applySeerSearchQuery = jest.fn();
    render(
      <SearchQueryBuilderProvider {...defaultProps}>
        <AskSeerComboBox
          initialQuery=""
          askSeerMutationOptions={askSeerMutationOptions}
          applySeerSearchQuery={applySeerSearchQuery}
          analyticsSource="test"
          feedbackSource="test"
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
          analyticsSource="test"
          feedbackSource="test"
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
          analyticsSource="test"
          feedbackSource="test"
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
          analyticsSource="test"
          feedbackSource="test"
        />
      </SearchQueryBuilderProvider>,
      {organization: {...organization, hideAiFeatures: true}}
    );
    expect(container).toBeEmptyDOMElement();
  });
});
