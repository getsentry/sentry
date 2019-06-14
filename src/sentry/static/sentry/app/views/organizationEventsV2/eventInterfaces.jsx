import React from 'react';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import {INTERFACES} from 'app/components/events/eventEntries';
import ErrorBoundary from 'app/components/errorBoundary';
import EventDataSection from 'app/components/events/eventDataSection';
import EventDevice from 'app/components/events/device';
import EventExtraData from 'app/components/events/extraData';
import EventPackageData from 'app/components/events/packageData';
import NavTabs from 'app/components/navTabs';
import {objectIsEmpty, toTitleCase} from 'app/utils';

const OTHER_SECTIONS = {
  context: EventExtraData,
  packages: EventPackageData,
  device: EventDevice,
};

/**
 * Render the currently active event interface tab.
 * Some but not all interface elements require a projectId.
 */
const ActiveTab = props => {
  const {projectId, event, activeTab} = props;
  if (!activeTab) {
    return null;
  }
  const entry = event.entries.find(item => item.type === activeTab);
  if (INTERFACES[activeTab]) {
    const Component = INTERFACES[activeTab];
    return (
      <Component
        projectId={projectId}
        event={event}
        type={entry.type}
        data={entry.data}
        isShare={false}
      />
    );
  } else if (OTHER_SECTIONS[activeTab]) {
    const Component = OTHER_SECTIONS[activeTab];
    return <Component event={event} isShare={false} />;
  } else {
    /*eslint no-console:0*/
    window.console &&
      console.error &&
      console.error('Unregistered interface: ' + activeTab);

    return (
      <EventDataSection event={event} type={entry.type} title={entry.type}>
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

class EventInterfaces extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      activeTab: props.event.entries[0].type,
    };
  }

  handleTabChange = tab => this.setState({activeTab: tab});

  render() {
    const {event, projectId} = this.props;
    const {activeTab} = this.state;

    return (
      <React.Fragment>
        <NavTabs underlined={true}>
          {event.entries.map(entry => {
            if (!INTERFACES.hasOwnProperty(entry.type)) {
              return null;
            }
            const type = entry.type;
            const classname = type === activeTab ? 'active' : null;
            return (
              <li key={type} className={classname}>
                <a
                  href="#"
                  onClick={evt => {
                    evt.preventDefault();
                    this.handleTabChange(type);
                  }}
                >
                  {toTitleCase(type)}
                </a>
              </li>
            );
          })}
          {Object.keys(OTHER_SECTIONS).map(section => {
            if (objectIsEmpty(event[section])) {
              return null;
            }
            const classname = section === activeTab ? 'active' : null;
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
          <ActiveTab event={event} activeTab={activeTab} projectId={projectId} />
        </ErrorBoundary>
      </React.Fragment>
    );
  }
}

export default EventInterfaces;
