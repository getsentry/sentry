import EventView from 'sentry/utils/discover/eventView';
import {createRuleFromEventView} from 'sentry/views/alerts/rules/metric/constants';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';

describe('createRuleFromEventView()', () => {
  it('sets transaction dataset from event.type:transaction', () => {
    const eventView = new EventView({
      query: 'title:"nothing" event.type:transaction',
    });

    const rule = createRuleFromEventView(eventView);
    expect(rule.dataset).toBe(Dataset.TRANSACTIONS);
  });
  it('sets error dataset from event.type:error', () => {
    const eventView = new EventView({
      query: 'title:"nothing" event.type:error',
    });

    const rule = createRuleFromEventView(eventView);
    expect(rule.dataset).toBe(Dataset.ERRORS);
    expect(rule.eventTypes).toEqual([EventTypes.ERROR]);
  });
  it('removes event.type from query', () => {
    const eventView = new EventView({
      query: 'title:"nothing" event.type:error',
    });

    const rule = createRuleFromEventView(eventView);
    expect(rule.query).toBe('title:"nothing"');
  });
  it('gets environment from EventView', () => {
    const eventView = new EventView({
      environment: ['beta'],
    });

    const rule = createRuleFromEventView(eventView);
    expect(rule.environment).toBe('beta');
  });
  it('gets aggregate from EventView.yAxis', () => {
    const eventView = new EventView({
      yAxis: 'count_unique(user)',
    });

    const rule = createRuleFromEventView(eventView);
    expect(rule.aggregate).toBe(eventView.yAxis);
  });
  it('gets dataset and eventtypes from query', () => {
    const eventView = new EventView({
      query: 'event.type:error or event.type:default something',
    });

    const rule = createRuleFromEventView(eventView);
    expect(rule.dataset).toBe(Dataset.ERRORS);
    expect(rule.eventTypes).toEqual([EventTypes.ERROR, EventTypes.DEFAULT]);
  });
  it('allows pXX transaction querys', () => {
    const eventView = EventView.fromSavedQuery({
      id: undefined,
      query: 'event.type:transaction',
      yAxis: 'p95()',
      fields: ['p95()'],
    });

    const rule = createRuleFromEventView(eventView);
    expect(rule.aggregate).toBe('p95(transaction.duration)');
  });
});
