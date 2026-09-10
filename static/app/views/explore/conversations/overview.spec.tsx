import {OrganizationFixture} from 'sentry-fixture/organization';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';

import ConversationsOverviewPage from './overview';

const organization = OrganizationFixture({
  features: ['gen-ai-conversations', 'gen-ai-conversations-querying-enhancements'],
});

describe('ConversationsOverviewPage', () => {
  beforeEach(() => {
    PageFiltersStore.init();
    localStorage.setItem(
      `conversations:projects-with-data:${organization.slug}`,
      JSON.stringify([-1])
    );
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'count_unique(gen_ai.conversation.id)',
            meta: {valueType: 'number', valueUnit: null, interval: 1_800_000},
          }),
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      body: [],
    });
  });

  afterEach(() => {
    localStorage.clear();
    MockApiClient.clearMockResponses();
  });

  it('prefers recent filters when available', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      body: [{query: 'span.op:http'}],
    });
    render(<ConversationsOverviewPage />, {organization});

    await userEvent.click(
      await screen.findByRole('combobox', {name: 'Add a search term'})
    );

    expect(await screen.findByTestId('recent-filter-key')).toHaveTextContent('span.op');
  });

  it('offers conversation aggregate aliases as filters', async () => {
    render(<ConversationsOverviewPage />, {organization});

    await userEvent.click(
      await screen.findByRole('combobox', {name: 'Add a search term'})
    );

    const aliases = [
      'conversation.age',
      'conversation.duration',
      'conversation.generationDuration',
      'conversation.errors',
      'conversation.messages',
      'conversation.toolCalls',
      'conversation.totalTokens',
      'conversation.inputTokens',
      'conversation.outputTokens',
      'conversation.totalCost',
      'conversation.toolErrors',
    ];
    const options = await screen.findAllByRole('option');

    aliases.forEach((alias, index) => {
      expect(options[index]).toHaveAccessibleName(alias);
    });

    await userEvent.keyboard('{ArrowDown}');
    expect(
      await screen.findByText("Time of the conversation's latest span.")
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('option', {name: 'conversation.generationDuration'})
    );
    expect(
      await screen.findByRole('row', {
        name: 'conversation.generationDuration:>10ms',
      })
    ).toBeInTheDocument();
  });
});
