import React from 'react';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import {INTERFACES} from 'app/components/events/eventEntries';

import ErrorBoundary from 'app/components/errorBoundary';
import EventContexts from 'app/components/events/contexts';
import EventDataSection from 'app/components/events/eventDataSection';
import EventDevice from 'app/components/events/device';
import EventExtraData from 'app/components/events/extraData';
import EventPackageData from 'app/components/events/packageData';
import NavTabs from 'app/components/navTabs';
import {objectIsEmpty, toTitleCase} from 'app/utils';
import {Event, Organization} from 'app/types';

import EventView from '../eventView';

const OTHER_SECTIONS = {
  contexts: EventContexts,
  extra: EventExtraData,
  packages: EventPackageData,
  device: EventDevice,
};

function getTabTitle(type: string): string {
  if (type === 'spans') {
    return 'Transaction';
  }

  return type;
}

type ActiveTabProps = {
  organization: Organization;
  projectId: string;
  event: Event;
  activeTab: string;
  eventView: EventView;
};

/**
 * Render the currently active event interface tab.
 * Some but not all interface elements require a projectId.
 */
const ActiveTab = (props: ActiveTabProps) => {
  const {organization, projectId, event, activeTab, eventView} = props;
  if (!activeTab) {
    return null;
  }
  const entry = event.entries.find(item => item.type === activeTab);
  if (INTERFACES[activeTab] && entry) {
    const Component = INTERFACES[activeTab];
    return (
      <Component
        projectId={projectId}
        orgId={organization.slug}
        event={event}
        eventView={eventView}
        type={entry.type}
        data={entry.data}
        isShare={false}
        hideGuide
      />
    );
  } else if (OTHER_SECTIONS[activeTab]) {
    const Component = OTHER_SECTIONS[activeTab];
    return <Component event={event} isShare={false} hideGuide />;
  } else {
    /*eslint no-console:0*/
    window.console &&
      console.error &&
      console.error('Unregistered interface: ' + activeTab);

    return (
      <EventDataSection
        type={entry && entry.type ? entry.type : ''}
        title={entry && entry.type ? entry.type : ''}
      >
        <p>{t('There was an error rendering this data.')}</p>
      </EventDataSection>
    );
  }
};
ActiveTab.propTypes = {
  event: SentryTypes.Event.isRequired,
  activeTab: PropTypes.string,
  projectId: PropTypes.string.isRequired,
};

type EventInterfacesProps = {
  event: Event;
  projectId: string;
  organization: Organization;
  eventView: EventView;
};
type EventInterfacesState = {
  activeTab: string;
};

class EventInterfaces extends React.Component<
  EventInterfacesProps,
  EventInterfacesState
> {
  constructor(props: EventInterfacesProps) {
    super(props);
    this.state = {
      activeTab: props.event.entries[0].type,
    };
  }

  handleTabChange = tab => this.setState({activeTab: tab});

  render() {
    const {event, projectId, organization, eventView} = this.props;
    const {activeTab} = this.state;

    return (
      <React.Fragment>
        <NavTabs underlined>
          {event.entries.map(entry => {
            if (!INTERFACES.hasOwnProperty(entry.type)) {
              return null;
            }
            const type = entry.type;
            const classname = type === activeTab ? 'active' : undefined;
            return (
              <li key={type} className={classname}>
                <a
                  href="#"
                  onClick={evt => {
                    evt.preventDefault();
                    this.handleTabChange(type);
                  }}
                >
                  {toTitleCase(getTabTitle(type))}
                </a>
              </li>
            );
          })}
          {Object.keys(OTHER_SECTIONS).map(section => {
            if (
              objectIsEmpty(event[section]) ||
              (section === 'contexts' &&
                (objectIsEmpty(event.contexts) && objectIsEmpty(event.user)))
            ) {
              return null;
            }
            const classname = section === activeTab ? 'active' : undefined;
            return (
              <li key={section} className={classname}>
                <a
                  href="#"
                  onClick={evt => {
                    evt.preventDefault();
                    this.handleTabChange(section);
                  }}
                >
                  {toTitleCase(section)}
                </a>
              </li>
            );
          })}
        </NavTabs>
        <ErrorBoundary message={t('Could not render event details')}>
          <ActiveTab
            event={event}
            activeTab={activeTab}
            projectId={projectId}
            organization={organization}
            eventView={eventView}
          />
        </ErrorBoundary>
      </React.Fragment>
    );
  }
}

export default EventInterfaces;
