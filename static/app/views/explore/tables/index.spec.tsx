import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {getValidatedAggregateFields} from 'sentry/views/explore/tables';

describe('getValidatedAggregateFields', () => {
  it('removes aggregate fields with invalid fields', () => {
    const validatedAggregateFields = getValidatedAggregateFields({
      aggregateFields: [
        {groupBy: 'span.op'},
        {groupBy: 'missing.group'},
        new VisualizeFunction('avg(sentry.duration)'),
        new VisualizeFunction('avg(missing.duration)'),
        new VisualizeFunction('missing()'),
      ],
      invalidFields: new Set(['missing.group', 'missing.duration', 'missing()']),
    });

    expect(
      validatedAggregateFields.map(aggregateField => {
        if ('groupBy' in aggregateField) {
          return aggregateField.groupBy;
        }
        return aggregateField.yAxis;
      })
    ).toEqual(['span.op', 'avg(sentry.duration)']);
  });
});
