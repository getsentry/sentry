import {TabularColumnsFixture} from 'sentry-fixture/tabularColumns';

import {decodeColumnAliases} from 'sentry/views/dashboards/widgets/tableWidget/utils';

describe('Table Widget Visualization Utils', function () {
  describe('decodeColumnAliases', function () {
    const columns = TabularColumnsFixture([
      {
        key: 'columnOne',
        name: 'columnOne',
      },
      {
        key: 'columnTwo',
        name: 'columnTwo',
      },
    ]);
    const fieldAliases = ['Column One', ''];
    const fieldHeaderMap: Record<string, string> = {
      columnOne: 'Custom column ONE',
      columnTwo: 'Custom column TWO',
    };

    it('correctly combines both fieldAliases and fieldHeaderMap', function () {
      const result = decodeColumnAliases(columns, fieldAliases, fieldHeaderMap);
      expect(result.columnOne).toEqual(fieldAliases[0]);
      expect(result.columnTwo).toEqual(fieldHeaderMap.columnTwo);
    });

    it('correctly defers to empty record if columns and fieldAlises do not match', function () {
      const result = decodeColumnAliases([], fieldAliases);
      expect(result).toEqual({});
    });
  });
});
