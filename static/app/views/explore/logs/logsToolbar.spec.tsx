import type {ReactNode} from 'react';
import {initializeLogsTest} from 'sentry-fixture/log';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LOGS_AGGREGATE_FIELD_KEY} from 'sentry/views/explore/logs/logsQueryParams';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsToolbar} from 'sentry/views/explore/logs/logsToolbar';
import {
  useQueryParamsGroupBys,
  useQueryParamsMode,
} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

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

function makeValidationBody(fields: EventValidationData['field']): EventValidationData {
  return {
    dataset: [],
    environment: [],
    field: fields,
    orderby: [],
    projects: [],
    query: {
      error: null,
      fields: [],
      valid: true,
    },
    valid: fields.every(field => field.valid),
  };
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
        {
          attributeType: 'number',
          key: 'bar',
          name: 'bar',
          attributeSource: {source_type: 'custom'},
        },
        {
          attributeType: 'number',
          key: 'foo',
          name: 'foo',
          attributeSource: {source_type: 'custom'},
        },
        {
          attributeType: 'string',
          key: 'severity',
          name: 'severity',
          attributeSource: {source_type: 'custom'},
        },
        {
          attributeType: 'string',
          key: 'custom.string_tag',
          name: 'custom.string_tag',
          attributeSource: {source_type: 'custom'},
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/validate/`,
      body: makeValidationBody([]),
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

    it('keeps the selected field when it is not in the default attribute list', async () => {
      const searchAttributesMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/trace-items/attributes/`,
        method: 'GET',
        body: [
          {
            attributeType: 'number',
            key: 'searched_number',
            name: 'searched_number',
            attributeSource: {source_type: 'custom'},
          },
        ],
        match: [MockApiClient.matchQuery({substringMatch: 'searched'})],
      });

      const {router} = render(<LogsToolbar />, {
        organization,
        additionalWrapper: Wrapper,
      });

      // The default number attributes do not include `searched_number`.
      await userEvent.click(screen.getByRole('button', {name: 'count'}));
      await userEvent.click(screen.getByRole('option', {name: 'avg'}));

      await userEvent.click(screen.getByRole('button', {name: 'bar'}));
      const searchInput = screen.getByRole('textbox');
      await userEvent.type(searchInput, 'searched');
      await waitFor(() => expect(searchAttributesMock).toHaveBeenCalled());

      await userEvent.click(await screen.findByRole('option', {name: 'searched_number'}));

      // Once the search clears, `searched_number` is no longer in the fetched
      // attributes, but the dropdown must keep displaying the selected field
      // rather than reverting to an empty value.
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['avg(searched_number)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );
      expect(
        await screen.findByRole('button', {name: 'searched_number'})
      ).toBeInTheDocument();
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
      let mode: Mode | undefined;

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

    it('disables an attribute already selected in another group by', async () => {
      render(<LogsToolbar />, {
        organization,
        additionalWrapper: Wrapper,
      });

      const firstColumn = screen.getAllByTestId('editor-column')[0]!;
      await userEvent.click(within(firstColumn).getByRole('button', {name: '—'}));
      await userEvent.click(screen.getByRole('option', {name: 'message'}));

      await userEvent.click(screen.getByRole('button', {name: 'Add Group'}));

      const secondColumn = screen.getAllByTestId('editor-column')[1]!;
      await userEvent.click(within(secondColumn).getByRole('button', {name: '—'}));

      expect(await screen.findByRole('option', {name: 'message'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(screen.getByRole('option', {name: 'severity'})).not.toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('can clear the last selected group by', async () => {
      let mode: Mode | undefined;

      function Component() {
        mode = useQueryParamsMode();
        return <LogsToolbar />;
      }
      const {router} = render(<Component />, {organization, additionalWrapper: Wrapper});

      const section = screen.getByTestId('section-group-by');
      const editorColumn = screen.getAllByTestId('editor-column')[0]!;
      await userEvent.click(within(editorColumn).getByRole('button', {name: '—'}));
      await userEvent.click(screen.getByRole('option', {name: 'message'}));

      expect(mode).toEqual(Mode.AGGREGATE);
      expect(within(section).queryByLabelText('Remove Column')).not.toBeInTheDocument();

      await userEvent.click(within(section).getByLabelText('Clear Group By'));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['count(message)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );

      expect(mode).toEqual(Mode.SAMPLES);
      expect(within(section).queryByLabelText('Clear Group By')).not.toBeInTheDocument();
    });

    it('uses the validated field type for a selected group by', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/validate/`,
        body: makeValidationBody([
          {
            attrType: 'number',
            error: null,
            name: 'custom.measurement',
            valid: true,
          },
        ]),
      });

      render(<LogsToolbar />, {
        organization,
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/logs/`,
            query: {
              [LOGS_AGGREGATE_FIELD_KEY]: [
                JSON.stringify({groupBy: 'custom.measurement'}),
                JSON.stringify({yAxes: ['count(message)']}),
              ],
            },
          },
        },
      });

      const section = screen.getByTestId('section-group-by');
      const editorColumn = screen.getAllByTestId('editor-column')[0]!;
      await userEvent.click(
        await within(editorColumn).findByRole('button', {name: 'custom.measurement'})
      );

      const option = await within(section).findByRole('option', {
        name: 'custom.measurement',
      });
      await waitFor(() => expect(option).toHaveTextContent('number'));
    });

    it('does not render an unvalidated selected group by while validation loads', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/validate/`,
        asyncDelay: 100000,
        body: makeValidationBody([
          {
            attrType: null,
            error: 'Invalid attribute',
            name: 'invalid.attribute',
            valid: false,
          },
        ]),
      });

      render(<LogsToolbar />, {
        organization,
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/logs/`,
            query: {
              [LOGS_AGGREGATE_FIELD_KEY]: [
                JSON.stringify({groupBy: 'invalid.attribute'}),
                JSON.stringify({yAxes: ['count(message)']}),
              ],
            },
          },
        },
      });

      const section = screen.getByTestId('section-group-by');
      await waitFor(() =>
        expect(
          within(section).queryByRole('button', {name: 'invalid.attribute'})
        ).not.toBeInTheDocument()
      );
      await waitFor(() =>
        expect(
          within(section).getAllByRole('button', {name: '—'}).length
        ).toBeGreaterThan(0)
      );
    });

    it('does not remove selected group bys using placeholder validation data', async () => {
      const delayedValidateMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/validate/`,
        asyncDelay: 100000,
        body: makeValidationBody([
          {
            attrType: null,
            error: 'Invalid attribute',
            name: 'invalid.attribute',
            valid: false,
          },
        ]),
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/validate/`,
        match: [
          (_url, options) => JSON.stringify(options.query?.field).includes('valid.first'),
        ],
        body: makeValidationBody([
          {
            attrType: 'string',
            error: null,
            name: 'valid.first',
            valid: true,
          },
          {
            attrType: null,
            error: 'Invalid attribute',
            name: 'invalid.attribute',
            valid: false,
          },
        ]),
      });

      const {router} = render(<LogsToolbar />, {
        organization,
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/logs/`,
            query: {
              [LOGS_AGGREGATE_FIELD_KEY]: [
                JSON.stringify({groupBy: 'valid.first'}),
                JSON.stringify({yAxes: ['count(message)']}),
              ],
            },
          },
        },
      });

      const section = screen.getByTestId('section-group-by');
      await within(section).findAllByRole('button', {name: 'valid.first'});

      const nextParams = new URLSearchParams();
      nextParams.append(
        LOGS_AGGREGATE_FIELD_KEY,
        JSON.stringify({groupBy: 'invalid.attribute'})
      );
      nextParams.append(
        LOGS_AGGREGATE_FIELD_KEY,
        JSON.stringify({yAxes: ['count(message)']})
      );
      act(() => {
        router.navigate(
          `/organizations/${organization.slug}/explore/logs/?${nextParams}`
        );
      });

      await waitFor(() => expect(delayedValidateMock).toHaveBeenCalled());
      expect(router.location.query[LOGS_AGGREGATE_FIELD_KEY]).toEqual([
        JSON.stringify({groupBy: 'invalid.attribute'}),
        JSON.stringify({yAxes: ['count(message)']}),
      ]);
    });

    it('removes invalid selected group bys and preserves empty values', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/validate/`,
        body: makeValidationBody([
          {
            attrType: null,
            error: 'Invalid attribute',
            name: 'invalid.attribute',
            valid: false,
          },
          {
            attrType: 'string',
            error: null,
            name: 'severity',
            valid: true,
          },
        ]),
      });

      let groupBys: readonly string[] = [];
      function Component() {
        groupBys = useQueryParamsGroupBys();
        return <LogsToolbar />;
      }

      const {router} = render(<Component />, {
        organization,
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/logs/`,
            query: {
              [LOGS_AGGREGATE_FIELD_KEY]: [
                JSON.stringify({groupBy: 'invalid.attribute'}),
                JSON.stringify({groupBy: ''}),
                JSON.stringify({groupBy: 'severity'}),
                JSON.stringify({yAxes: ['count(message)']}),
              ],
            },
          },
        },
      });

      await waitFor(() => expect(groupBys).toEqual(['', 'severity']));
      expect(router.location.query[LOGS_AGGREGATE_FIELD_KEY]).toEqual([
        JSON.stringify({groupBy: ''}),
        JSON.stringify({groupBy: 'severity'}),
        JSON.stringify({yAxes: ['count(message)']}),
      ]);
      expect(
        screen.queryByRole('button', {name: 'invalid.attribute'})
      ).not.toBeInTheDocument();
    });
  });

  it('re-fetches attributes on search', async () => {
    const searchAttributesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [
        {
          attributeType: 'string',
          key: 'custom.searched_tag',
          name: 'custom.searched_tag',
          attributeSource: {source_type: 'custom'},
        },
        {
          attributeType: 'number',
          key: 'searched_number',
          name: 'searched_number',
          attributeSource: {source_type: 'custom'},
        },
      ],
      match: [
        MockApiClient.matchQuery({
          attributeType: ['string', 'number', 'boolean'],
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

    await waitFor(() => expect(searchAttributesMock).toHaveBeenCalled());

    expect(
      await screen.findByRole('option', {name: 'custom.searched_tag'})
    ).toBeInTheDocument();
  });
});
