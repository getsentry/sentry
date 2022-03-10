import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  mountWithTheme as reactMountWithTheme,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

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
      reactMountWithTheme(
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
      mountComponent();
    });
    it('renders issue and assignee columns', function () {
      expect(screen.getByText('issue')).toBeInTheDocument();
      expect(screen.getByText('assignee')).toBeInTheDocument();
    });
    it('renders only issue column', function () {
      expect(screen.getByText('issue')).toBeInTheDocument();
      userEvent.click(screen.getByTestId('remove-column-1'));
      expect(screen.queryByText('assignee')).not.toBeInTheDocument();
    });
    it('renders issue column and then assignee column after adding', function () {
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
});
