import {TabularColumnsFixture} from 'sentry-fixture/tabularColumns';

import {decodeColumnAliases} from 'sentry/views/dashboards/widgets/tableWidget/utils';

describe('Table Widget Visualization Utils', () => {
  describe('decodeColumnAliases', () => {
    const columns = TabularColumnsFixture([
      {
        key: 'columnOne',
      },
      {
        key: 'columnTwo',
      },
    ]);
    const fieldAliases = ['Column One', ''];
    const fieldHeaderMap: Record<string, string> = {
      columnOne: 'Custom column ONE',
      columnTwo: 'Custom column TWO',
    };

    it('correctly combines both fieldAliases and fieldHeaderMap', () => {
      const result = decodeColumnAliases(columns, fieldAliases, fieldHeaderMap);
      expect(result.columnOne).toEqual(fieldAliases[0]);
      expect(result.columnTwo).toEqual(fieldHeaderMap.columnTwo);
    });

    it('correctly defers to empty record if columns and fieldAlises do not match', () => {
      const result = decodeColumnAliases([], fieldAliases);
      expect(result).toEqual({});
    });
  });
});
