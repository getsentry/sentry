import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import WidgetQueryFields from 'sentry/components/dashboards/widgetQueryFields';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';

describe('WidgetQueryFields', function () {
  describe('Discover Fields', function () {
    const {routerContext} = initializeOrg();
    const organization = TestStubs.Organization();
    let wrapper;

    beforeEach(() => {
      // TODO change this to react testing library
      wrapper = mountWithTheme(
        <WidgetQueryFields
          widgetType={WidgetType.DISCOVER}
          displayType={DisplayType.TOP_N}
          fieldOptions={{
            'function:count': {
              label: 'count()',
              value: {
                kind: FieldValueKind.FUNCTION,
                meta: {
                  name: 'count',
                  parameters: [],
                },
              },
            },
            'field:title': {
              label: 'title',
              value: {
                kind: FieldValueKind.FIELD,
                meta: {
                  name: 'title',
                  dataType: 'string',
                },
              },
            },
            'function:p95': {
              label: 'p95(…)',
              value: {
                kind: FieldValueKind.FUNCTION,
                meta: {
                  name: 'p95',
                  parameters: [],
                },
              },
            },
          }}
          fields={[
            {
              kind: 'field',
              field: 'title',
            },
            {
              kind: 'function',
              function: ['count', '', undefined, undefined],
            },
            {
              kind: 'function',
              function: ['p95', 'transaction.duration', undefined, undefined],
            },
          ]}
          organization={organization}
          onChange={() => undefined}
        />,
        routerContext
      );
    });

    it('renders with grey dotted previous period when using only a single series', function () {
      const columns = wrapper.find('StyledColumnEditCollection').find('QueryField');
      expect(columns.length).toEqual(2);
      expect(columns.at(0).props().fieldValue).toEqual({
        kind: 'field',
        field: 'title',
      });
      expect(columns.at(1).props().fieldValue).toEqual({
        kind: 'function',
        function: ['count', '', undefined, undefined],
      });
      expect(
        wrapper.find('QueryFieldWrapper').find('QueryField').props().fieldValue
      ).toEqual({
        function: ['p95', 'transaction.duration', undefined, undefined],
        kind: 'function',
      });
    });
  });

  describe('Issue Fields', function () {
    const organization = TestStubs.Organization();
    let fields: QueryFieldValue[];

    const mountComponent = () =>
      render(
        <WidgetQueryFields
          widgetType={WidgetType.ISSUE}
          displayType={DisplayType.TABLE}
          fieldOptions={{
            'field:issue': {
              label: 'issue',
              value: {
                kind: FieldValueKind.FIELD,
                meta: {
                  name: 'issue',
                  dataType: 'string',
                },
              },
            },
            'field:assignee': {
              label: 'assignee',
              value: {
                kind: FieldValueKind.FIELD,
                meta: {
                  name: 'assignee',
                  dataType: 'string',
                },
              },
            },
          }}
          fields={fields}
          organization={organization}
          onChange={newFields => {
            fields.splice(0, fields.length, ...newFields);
          }}
        />
      );

    beforeEach(() => {
      fields = [
        {
          kind: 'field',
          field: 'issue',
        },
        {
          kind: 'field',
          field: 'assignee',
        },
      ];
    });
    it('renders issue and assignee columns', function () {
      mountComponent();

      expect(screen.getByText('issue')).toBeInTheDocument();
      expect(screen.getByText('assignee')).toBeInTheDocument();
    });
    it('renders only issue column', function () {
      mountComponent();

      expect(screen.getByText('issue')).toBeInTheDocument();
      userEvent.click(screen.getByTestId('remove-column-1'));
      expect(screen.queryByText('assignee')).not.toBeInTheDocument();
    });
    it('renders issue column and then assignee column after adding', function () {
      mountComponent();

      userEvent.click(screen.getByTestId('remove-column-1'));
      expect(screen.queryByText('assignee')).not.toBeInTheDocument();
      expect(screen.getByText('Add a Column')).toBeInTheDocument();
      userEvent.click(screen.getByText('Add a Column'));
      mountComponent();
      expect(screen.getByText('(Required)')).toBeInTheDocument();
      userEvent.keyboard('a');
      userEvent.click(screen.getByText('assignee'));
      mountComponent();
      expect(screen.getByText('assignee')).toBeInTheDocument();
    });
  });

  describe('Metrics Fields', function () {
    const organization = TestStubs.Organization();

    it('top N shows the right options for y-axis and columns', function () {
      render(
        <WidgetQueryFields
          widgetType={WidgetType.RELEASE}
          displayType={DisplayType.TOP_N}
          fieldOptions={{
            'field:sentry.sessions.session': {
              label: 'sentry.sessions.session',
              value: {
                kind: FieldValueKind.METRICS,
                meta: {name: 'sentry.sessions.session', dataType: 'integer'},
              },
            },
            'field:sentry.sessions.session.error': {
              label: 'sentry.sessions.session.error',
              value: {
                kind: FieldValueKind.METRICS,
                meta: {name: 'sentry.sessions.session.error', dataType: 'integer'},
              },
            },
            'field:sentry.sessions.user': {
              label: 'sentry.sessions.user',
              value: {
                kind: FieldValueKind.METRICS,
                meta: {name: 'sentry.sessions.user', dataType: 'string'},
              },
            },
            'function:count_unique': {
              label: 'count_unique(…)',
              value: {
                kind: FieldValueKind.FUNCTION,
                meta: {
                  name: 'count_unique',
                  parameters: [
                    {
                      kind: 'column',
                      columnTypes: ['string'],
                      required: true,
                      defaultValue: 'sentry.sessions.user',
                    },
                  ],
                },
              },
            },
            'function:sum': {
              label: 'sum(…)',
              value: {
                kind: FieldValueKind.FUNCTION,
                meta: {
                  name: 'sum',
                  parameters: [
                    {
                      kind: 'column',
                      columnTypes: ['integer'],
                      required: true,
                      defaultValue: 'sentry.sessions.session',
                    },
                  ],
                },
              },
            },
            'tag:environment': {
              label: 'environment',
              value: {
                kind: FieldValueKind.TAG,
                meta: {name: 'environment', dataType: 'string'},
              },
            },
            'tag:release': {
              label: 'release',
              value: {
                kind: FieldValueKind.TAG,
                meta: {name: 'release', dataType: 'string'},
              },
            },
            'tag:session.status': {
              label: 'session.status',
              value: {
                kind: FieldValueKind.TAG,
                meta: {name: 'session.status', dataType: 'string'},
              },
            },
          }}
          fields={[
            {kind: 'field', field: 'release'},
            {
              kind: 'function',
              function: ['sum', 'sentry.sessions.session', undefined, undefined],
            },
          ]}
          organization={organization}
          onChange={() => undefined}
        />
      );

      // ensure that columns section shows only tags
      userEvent.click(screen.getByText('release'));
      expect(screen.getByText('environment')).toBeInTheDocument();
      expect(screen.getByText('session.status')).toBeInTheDocument();
      expect(screen.queryByText('count_unique(…)')).not.toBeInTheDocument();

      // ensure that y-axis section shows only functions/fields
      userEvent.click(screen.getByText('sum(…)'));
      expect(screen.getByText('count_unique(…)')).toBeInTheDocument();
      expect(screen.queryByText('environment')).not.toBeInTheDocument();
    });
  });
});
