import {Dataset} from 'app/views/settings/incidentRules/types';
import EventView from 'app/utils/discover/eventView';
import {createRuleFromEventView} from 'app/views/settings/incidentRules/constants';

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
});
