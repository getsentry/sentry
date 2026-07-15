import {destroyAnnouncer} from '@react-aria/live-announcer';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AskSeerPollingComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerPollingComboBox';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';

const defaultProviderProps = {
  enableAISearch: true,
  filterKeys: {},
  getTagValues: () => Promise.resolve([]),
  initialQuery: '',
  searchSource: 'test',
};

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
    {organization}
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

  it('preserves the existing loading experience when the rework is disabled', async () => {
    renderPollingComboBox(['gen-ai-features']);
    await submitQuery();

    expect(await screen.findByText("I'm on it...")).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the single loading status when the rework is enabled', async () => {
    renderPollingComboBox(['gen-ai-features', 'gen-ai-ask-seer-ux-rework']);
    await submitQuery();

    expect(await screen.findByRole('status')).toHaveTextContent("I'm on it...");
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });
});
