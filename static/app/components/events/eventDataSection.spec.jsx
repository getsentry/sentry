import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import EventDataSection from 'sentry/components/events/eventDataSection';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

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

function TestComponent({children}) {
  const {organization, router} = initializeOrg();

  return (
    <OrganizationContext.Provider value={organization}>
      <RouteContext.Provider
        value={{
          router,
          location: router.location,
          params: {},
          routes: [],
        }}
      >
        {children}
      </RouteContext.Provider>
    </OrganizationContext.Provider>
  );
}

describe('EventDataSection', function () {
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
  it('renders formatted', function () {
    const wrapper = render(
      <TestComponent>
        <EventDataSection
          group={groupData}
          event={eventData}
          type="extra"
          title="Additional Data"
          raw={false}
        />
      </TestComponent>
    );

    expect(wrapper.container).toSnapshot();
  });

  it('renders raw', function () {
    const wrapper = render(
      <TestComponent>
        <EventDataSection
          group={groupData}
          event={eventData}
          type="extra"
          title="Additional Data"
          raw
        />
      </TestComponent>
    );
    expect(wrapper.container).toSnapshot();
  });
});

describe('KeyValueList', function () {
  const context = {
    somestuff: {andsomeotherstuff: 'here'},
    plussomeotherstuff: 'here',
    andthis: 0,
  };

  const extraDataArray = Object.entries(context).map(([key, value]) => ({
    key,
    value,
    subject: key,
  }));

  it('renders formatted', function () {
    const wrapper = render(
      <TestComponent>
        <KeyValueList data={extraDataArray} isContextData raw={false} />
      </TestComponent>
    );

    expect(wrapper.container).toSnapshot();
  });

  it('renders raw', function () {
    const wrapper = render(
      <TestComponent>
        <KeyValueList data={extraDataArray} isContextData raw />
      </TestComponent>
    );

    expect(wrapper.container).toSnapshot();
  });
});
