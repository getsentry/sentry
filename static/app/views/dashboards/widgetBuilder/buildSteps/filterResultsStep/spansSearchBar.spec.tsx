import type {ComponentProps} from 'react';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {TagValue} from 'sentry/types/group';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import SpansSearchBar from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/spansSearchBar';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';

// The endpoint seems to just return these fields, but the original TagValue type
// has extra fields related to user information that we don't seem to need.
interface MockedTagValue
  extends Pick<TagValue, 'key' | 'value' | 'name' | 'count' | 'firstSeen' | 'lastSeen'> {}

function renderWithProvider({
  widgetQuery,
  onSearch,
}: ComponentProps<typeof SpansSearchBar>) {
  return render(
    <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
      <SpansSearchBar widgetQuery={widgetQuery} onSearch={onSearch} />
    </SpanTagsProvider>
  );
}

function mockSpanTags({
  type,
  mockedTags,
}: {
  mockedTags: Array<{key: string; name: string}>;
  type: 'string' | 'number';
}) {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/spans/fields/`,
    body: mockedTags,
    match: [
      function (_url: string, options: Record<string, any>) {
        return options.query.type === type;
      },
    ],
  });
}

function mockSpanTagValues({
  type,
  tagKey,
  mockedValues,
}: {
  mockedValues: MockedTagValue[];
  tagKey: string;
  type: 'string' | 'number';
}) {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/spans/fields/${tagKey}/values/`,
    body: mockedValues,
    match: [
      function (_url: string, options: Record<string, any>) {
        return options.query.type === type;
      },
    ],
  });
}

describe('SpansSearchBar', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/recent-searches/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/recent-searches/`,
      body: [],
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/spans/fields/`,
      body: [],
    });

    mockSpanTags({type: 'string', mockedTags: []});
    mockSpanTagValues({type: 'string', tagKey: 'span.op', mockedValues: []});

    mockSpanTags({type: 'number', mockedTags: []});
    mockSpanTagValues({type: 'number', tagKey: 'span.op', mockedValues: []});
  });

  it('renders the initial query conditions', async () => {
    mockSpanTags({type: 'string', mockedTags: [{key: 'span.op', name: 'span.op'}]});
    mockSpanTagValues({
      type: 'string',
      tagKey: 'span.op',
      mockedValues: [
        {
          key: 'span.op',
          value: 'function',
          name: 'function',
          count: 1,
          firstSeen: '2024-01-01',
          lastSeen: '2024-01-01',
        },
      ],
    });

    renderWithProvider({
      widgetQuery: WidgetQueryFixture({conditions: 'span.op:function'}),
      onSearch: jest.fn(),
    });

    await screen.findByLabelText('span.op:function');
  });

  it('calls onSearch with the correct query', async () => {
    const onSearch = jest.fn();

    renderWithProvider({widgetQuery: WidgetQueryFixture({conditions: ''}), onSearch});

    const searchInput = await screen.findByRole('combobox', {
      name: 'Add a search term',
    });
    await userEvent.type(searchInput, 'span.op:function');

    // It takes two enters. One to enter the search term, and one to submit the search.
    await userEvent.keyboard('{enter}');
    await userEvent.keyboard('{enter}');

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('span.op:function', expect.anything());
    });
  });
});
