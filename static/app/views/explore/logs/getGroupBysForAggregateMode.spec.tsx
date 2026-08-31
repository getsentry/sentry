import {getGroupBysForAggregateMode} from 'sentry/views/explore/logs/getGroupBysForAggregateMode';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

describe('getGroupBysForAggregateMode', () => {
  it('returns null when nothing is grouped yet', () => {
    const groupBys = getGroupBysForAggregateMode({
      fields: ['timestamp', 'message', 'severity'],
      groupBys: [''],
      visualizes: [new VisualizeFunction('count(message)')],
    });

    expect(groupBys).toBeNull();
  });

  it('returns null when every sample field is already accounted for', () => {
    const groupBys = getGroupBysForAggregateMode({
      fields: ['timestamp', 'message', 'tags[relative_deviation,number]'],
      groupBys: ['message'],
      visualizes: [new VisualizeFunction('avg(tags[relative_deviation,number])')],
    });

    expect(groupBys).toBeNull();
  });

  it('adds the remaining sample fields as group bys when already grouping', () => {
    const groupBys = getGroupBysForAggregateMode({
      fields: [
        'timestamp',
        'message',
        'tags[ds_proj_id,number]',
        'tags[relative_deviation,number]',
      ],
      groupBys: ['message'],
      visualizes: [new VisualizeFunction('avg(tags[relative_deviation,number])')],
    });

    expect(groupBys).toEqual(['message', 'tags[ds_proj_id,number]']);
  });

  it('skips fields that cannot be grouped by', () => {
    const groupBys = getGroupBysForAggregateMode({
      fields: ['id', 'timestamp', 'severity'],
      groupBys: ['message'],
      visualizes: [new VisualizeFunction('count(message)')],
    });

    expect(groupBys).toEqual(['message', 'severity']);
  });

  it('skips the argument of a conditional aggregate', () => {
    const groupBys = getGroupBysForAggregateMode({
      fields: ['severity', 'tags[relative_deviation,number]'],
      groupBys: ['message'],
      visualizes: [
        new VisualizeFunction('avg_if(`severity:error`,tags[relative_deviation,number])'),
      ],
    });

    expect(groupBys).toEqual(['message', 'severity']);
  });

  it('drops empty group bys and duplicated fields when merging', () => {
    const groupBys = getGroupBysForAggregateMode({
      fields: ['severity', 'severity', 'message'],
      groupBys: ['message', ''],
      visualizes: [new VisualizeFunction('count(message)')],
    });

    expect(groupBys).toEqual(['message', 'severity']);
  });
});
