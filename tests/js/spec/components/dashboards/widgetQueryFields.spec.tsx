import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import WidgetQueryFields from 'app/components/dashboards/widgetQueryFields';
import {DisplayType} from 'app/views/dashboardsV2/types';
import {FieldValueKind} from 'app/views/eventsV2/table/types';

describe('BaseChart', function () {
  const {routerContext} = initializeOrg();
  const organization = TestStubs.Organization();
  let wrapper;

  beforeEach(() => {
    wrapper = mountWithTheme(
      <WidgetQueryFields
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
