import {getFields, mapErrors} from 'sentry/views/dashboards/widgetBuilder/utils';

describe('WidgetBuilder utils', function () {
  describe('mapErrors', function () {
    it('able to handle string and string[] validation errors', () => {
      const flatValidation = mapErrors(
        {
          queries: [{fields: 'just a string'}],
          another: [{fields: ['another string']}],
        },
        {}
      );
      expect(flatValidation).toEqual({
        queries: [{fields: 'just a string'}],
        another: [{fields: 'another string'}],
      });
    });
  });

  describe('getFields', function () {
    it('splits simple fields by comma', function () {
      const testFieldsString = 'title,transaction';
      const actual = getFields(testFieldsString);
      expect(actual).toEqual(['title', 'transaction']);
    });

    it('splits aggregate fields by comma', function () {
      const testFieldsString = 'p75(),p95()';
      const actual = getFields(testFieldsString);
      expect(actual).toEqual(['p75()', 'p95()']);
    });

    it('does not split aggregates with inner commas', function () {
      const testFieldsString = 'p75(),count_if(transaction.duration,equal,200),p95()';
      const actual = getFields(testFieldsString);
      expect(actual).toEqual([
        'p75()',
        'count_if(transaction.duration,equal,200)',
        'p95()',
      ]);
    });
  });
});
