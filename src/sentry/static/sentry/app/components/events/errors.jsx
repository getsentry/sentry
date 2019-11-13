import React from 'react';
import uniqWith from 'lodash/uniqWith';
import isEqual from 'lodash/isEqual';

import EventDataSection from 'app/components/events/eventDataSection';
import EventErrorItem from 'app/components/events/errorItem';
import SentryTypes from 'app/sentryTypes';
import {t, tn} from 'app/locale';

const MAX_ERRORS = 100;

class EventErrors extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      isOpen: false,
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (this.state.isOpen !== nextState.isOpen) {
      return true;
    }
    return this.props.event.id !== nextProps.event.id;
  }

  toggle = () => {
    this.setState({isOpen: !this.state.isOpen});
  };

  uniqueErrors = errors => {
    return uniqWith(errors, isEqual);
  };

  render() {
    const eventErrors = this.props.event.errors;
    // XXX: uniqueErrors is not performant with large datasets
    const errors =
      eventErrors.length > MAX_ERRORS ? eventErrors : this.uniqueErrors(eventErrors);
    const numErrors = errors.length;
    const isOpen = this.state.isOpen;
    return (
      <EventDataSection event={this.props.event} type="errors" className="errors">
        <span className="icon icon-alert" />
        <p>
          <a className="pull-right errors-toggle" onClick={this.toggle}>
            {isOpen ? t('Hide') : t('Show')}
          </a>
          {tn(
            'There was %s error encountered while processing this event',
            'There were %s errors encountered while processing this event',
            numErrors
          )}
        </p>
        <ul style={{display: isOpen ? 'block' : 'none'}}>
          {errors.map((error, errorIdx) => {
            return <EventErrorItem key={errorIdx} error={error} />;
          })}
        </ul>
      </EventDataSection>
    );
  }
}

export default EventErrors;
