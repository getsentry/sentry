import React from 'react';
import {shallow} from 'enzyme';
import EventDataSection from 'app/components/events/eventDataSection';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import {objectToArray} from 'app/utils';

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
    let component = shallow(
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
    let component = shallow(
      <EventDataSection
        group={groupData}
        event={eventData}
        type="extra"
        title="Additional Data"
        raw={true}
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
  const extraDataArray = objectToArray(context);

  it('renders formatted', function() {
    let component = shallow(
      <KeyValueList data={extraDataArray} isContextData={true} raw={false} />
    );

    expect(component).toMatchSnapshot();
  });

  it('renders raw', function() {
    let component = shallow(
      <KeyValueList data={extraDataArray} isContextData={true} raw={true} />
    );

    expect(component).toMatchSnapshot();
  });
});
