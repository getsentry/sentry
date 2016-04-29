import React from 'react';
import {shallow} from 'enzyme';

import RuleNodeList from 'app/views/ruleEditor/ruleNodeList';

describe('RuleNodeList', function() {

  beforeEach(function() {
    this.sampleNodes = [
      {
        id: 'sentry.rules.conditions.every_event.EveryEventCondition',
        label: 'An event is seen',
        html: 'An event is seen'
      },
      {
        id: 'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
        label: 'An event is seen more than {value} times in {interval}',
        html: 'An event is seen more than <input id="id_value" name="value" placeholder="100" type="number" /> times ' +
              'in <select id="id_interval" name="interval">↵<option value="1m">one minute</option>↵<option value="1h">one hour</option>↵</select>'
      }
    ];
  });

  describe('getInitialItems()', function () {
    it('should give each initial item a unique incremented key_attr, and set state.counter', function () {
      let initialItems = [
        {
          id: 'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
          value: 50,
          interval: '1m'
        },
        {
          id: 'sentry.rules.conditions.every_event.EveryEventCondition'
        }
      ];

      let wrapper = shallow(<RuleNodeList nodes={this.sampleNodes} initialItems={initialItems}/>);

      expect(wrapper.state('items')[0]).to.have.property('key_attr', 0);
      expect(wrapper.state('items')[1]).to.have.property('key_attr', 1);
      expect(wrapper.state('counter')).to.equal(2);
    });
  });

  describe('onAddRow()', function() {
    it('should add a new item with key_attr value equal to state.counter, and increment state.counter', function () {
      let wrapper = shallow(<RuleNodeList nodes={this.sampleNodes} />);

      wrapper.setState({
        counter: 5
      });

      wrapper.instance().onAddRow({
        val: function () {
          return 'sentry.rules.conditions.every_event.EveryEventCondition';
        }
      });

      expect(wrapper.state('items')[0]).to.eql({
        id: 'sentry.rules.conditions.every_event.EveryEventCondition',
        key_attr: 5
      });
      expect(wrapper.state('counter')).to.equal(6);
    });
  });
});

