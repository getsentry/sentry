import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import EventDataSection from 'app/components/events/eventDataSection';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueList';

const data = {
  metadata: {
    title: 'metadata title',
    type: 'metadata type',
    directive: 'metadata directive',
    uri: 'metadata uri',
    value: 'metadata value',
    message: 'metadata message',
  },
  culprit: 'culprit',
};

describe('EventDataSection', function() {
  const groupData = {
    ...data,
    level: 'error',
    id: 'id',
  };
  const eventData = {
    ...data,
    id: 'id',
    eventID: 'eventID',
    groupID: 'groupID',
    culprit: undefined,
  };
  it('renders formatted', function() {
    const component = shallow(
      <EventDataSection
        group={groupData}
        event={eventData}
        type="extra"
        title="Additional Data"
        raw={false}
      />
    );

    expect(component).toMatchSnapshot();
  });

  it('renders raw', function() {
    const component = shallow(
      <EventDataSection
        group={groupData}
        event={eventData}
        type="extra"
        title="Additional Data"
        raw
      />
    );
    expect(component).toMatchSnapshot();
  });
});

describe('KeyValueList', function() {
  const context = {
    somestuff: {andsomeotherstuff: 'here'},
    plussomeotherstuff: 'here',
    andthis: 0,
  };
  const extraDataArray = Object.entries(context);

  it('renders formatted', function() {
    const component = shallow(
      <KeyValueList data={extraDataArray} isContextData raw={false} />
    );

    expect(component).toMatchSnapshot();
  });

  it('renders raw', function() {
    const component = shallow(<KeyValueList data={extraDataArray} isContextData raw />);

    expect(component).toMatchSnapshot();
  });
});
