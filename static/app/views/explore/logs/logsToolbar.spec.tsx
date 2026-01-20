import type {ReactNode} from 'react';
import {initializeLogsTest} from 'sentry-fixture/log';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsToolbar} from 'sentry/views/explore/logs/logsToolbar';
import {useQueryParamsMode} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';

function Wrapper({children}: {children: ReactNode}) {
  return (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
      source="location"
    >
      {children}
    </LogsQueryParamsProvider>
  );
}

describe('LogsToolbar', () => {
  const {organization, setupPageFilters} = initializeLogsTest();

  setupPageFilters();

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [
        {key: 'bar', name: 'bar', attributeSource: {source_type: 'custom'}},
        {key: 'foo', name: 'foo', attributeSource: {source_type: 'custom'}},
      ],
      match: [MockApiClient.matchQuery({attributeType: 'number', itemType: 'logs'})],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [
        {key: 'severity', name: 'severity', attributeSource: {source_type: 'custom'}},
        {
          key: 'custom.string_tag',
          name: 'custom.string_tag',
          attributeSource: {source_type: 'custom'},
        },
      ],
      match: [MockApiClient.matchQuery({attributeType: 'string', itemType: 'logs'})],
    });
  });

  describe('visualize section', () => {
    it('options disabled', async () => {
      render(<LogsToolbar />, {organization, additionalWrapper: Wrapper});

      await userEvent.click(screen.getByRole('button', {name: 'count'}));

      const aggregates = [
        'count',
        'count unique',
        'sum',
        'avg',
        'p50',
        'p75',
        'p90',
        'p95',
        'p99',
        'max',
        'min',
      ];

      aggregates.forEach(name => {
        expect(screen.getByRole('option', {name})).not.toHaveAttribute(
          'aria-disabled',
          'true'
        );
      });
    });

    it('uses the right default when switching aggregates', async () => {
      const {router} = render(<LogsToolbar />, {
        organization,
        additionalWrapper: Wrapper,
      });

      await userEvent.click(screen.getByRole('button', {name: 'count'}));
      await userEvent.click(screen.getByRole('option', {name: 'count unique'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['count_unique(message)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );

      await userEvent.click(screen.getByRole('button', {name: 'count unique'}));
      await userEvent.click(screen.getByRole('option', {name: 'avg'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['avg(bar)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );

      await userEvent.click(screen.getByRole('button', {name: 'avg'}));
      await userEvent.click(screen.getByRole('option', {name: 'count'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['count(message)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );
    });

    it('switches the parameter', async () => {
      const {router} = render(<LogsToolbar />, {
        organization,
        additionalWrapper: Wrapper,
      });

      // count has no user changable argument
      expect(screen.getByRole('button', {name: 'logs'})).toBeDisabled();

      // count unique only shows string attributes
      await userEvent.click(screen.getByRole('button', {name: 'count'}));
      await userEvent.click(screen.getByRole('option', {name: 'count unique'}));
      await userEvent.click(screen.getByRole('button', {name: 'message'}));
      expect(screen.getByRole('option', {name: 'bar'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'foo'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'severity'})).toBeInTheDocument();
      await userEvent.click(screen.getByRole('option', {name: 'severity'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['count_unique(severity)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );

      // avg shows only number attributes
      await userEvent.click(screen.getByRole('button', {name: 'count unique'}));
      await userEvent.click(screen.getByRole('option', {name: 'avg'}));
      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      expect(screen.getByRole('option', {name: 'bar'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'foo'})).toBeInTheDocument();
      await userEvent.click(screen.getByRole('option', {name: 'foo'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['avg(foo)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );
    });

    it('can add/delete visualizes', async () => {
      const {router} = render(<LogsToolbar />, {
        organization,
        additionalWrapper: Wrapper,
      });

      await userEvent.click(screen.getByRole('button', {name: 'count'}));
      await userEvent.click(screen.getByRole('option', {name: 'avg'}));

      await userEvent.click(screen.getByRole('button', {name: 'Add Chart'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['avg(bar)']}, {yAxes: ['count(message)']}].map(
          aggregateField => JSON.stringify(aggregateField)
        )
      );

      await userEvent.click(screen.getAllByLabelText('Remove Overlay')[0]!);
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['count(message)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );
    });
  });

  describe('group by section', () => {
    it('can switch group bys', async () => {
      let mode: Mode | undefined = undefined;

      function Component() {
        mode = useQueryParamsMode();
        return <LogsToolbar />;
      }
      const {router} = render(<Component />, {organization, additionalWrapper: Wrapper});

      expect(mode).toEqual(Mode.SAMPLES);

      const editorColumn = screen.getAllByTestId('editor-column')[0]!;
      await userEvent.click(within(editorColumn).getByRole('button', {name: '\u2014'}));
      await userEvent.click(screen.getByRole('option', {name: 'message'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: 'message'}, {yAxes: ['count(message)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );

      expect(mode).toEqual(Mode.AGGREGATE);

      await userEvent.click(within(editorColumn).getByRole('button', {name: 'message'}));
      await userEvent.click(screen.getByRole('option', {name: 'severity'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: 'severity'}, {yAxes: ['count(message)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );
      expect(mode).toEqual(Mode.AGGREGATE);
    });

    it('can add/delete group bys', async () => {
      const {router} = render(<LogsToolbar />, {
        organization,
        additionalWrapper: Wrapper,
      });

      const editorColumn = screen.getAllByTestId('editor-column')[0]!;
      await userEvent.click(within(editorColumn).getByRole('button', {name: '\u2014'}));
      await userEvent.click(screen.getByRole('option', {name: 'message'}));

      await userEvent.click(screen.getByRole('button', {name: 'Add Group'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: 'message'}, {groupBy: ''}, {yAxes: ['count(message)']}].map(
          aggregateField => JSON.stringify(aggregateField)
        )
      );

      await userEvent.click(screen.getAllByLabelText('Remove Column')[0]!);
      expect(router.location.query.aggregateField).toEqual(
        // BUG: a little weird that the 2nd group by moves up to take its place
        [{groupBy: ''}, {yAxes: ['count(message)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );
    });
  });

  it('re-fetches attributes on search', async () => {
    const searchStringMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [
        {
          key: 'custom.searched_tag',
          name: 'custom.searched_tag',
          attributeSource: {source_type: 'custom'},
        },
      ],
      match: [
        MockApiClient.matchQuery({
          attributeType: 'string',
          itemType: 'logs',
          substringMatch: 'searched',
        }),
      ],
    });

    const searchNumberMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [
        {
          key: 'searched_number',
          name: 'searched_number',
          attributeSource: {source_type: 'custom'},
        },
      ],
      match: [
        MockApiClient.matchQuery({
          attributeType: 'number',
          itemType: 'logs',
          substringMatch: 'searched',
        }),
      ],
    });

    render(<LogsToolbar />, {organization, additionalWrapper: Wrapper});

    const editorColumn = screen.getAllByTestId('editor-column')[0]!;
    await userEvent.click(within(editorColumn).getByRole('button', {name: '\u2014'}));

    expect(
      screen.queryByRole('option', {name: 'custom.searched_tag'})
    ).not.toBeInTheDocument();

    const searchInput = screen.getByRole('textbox');
    await userEvent.type(searchInput, 'searched');

    await waitFor(() => expect(searchStringMock).toHaveBeenCalled());
    await waitFor(() => expect(searchNumberMock).toHaveBeenCalled());

    expect(
      await screen.findByRole('option', {name: 'custom.searched_tag'})
    ).toBeInTheDocument();
  });
});
