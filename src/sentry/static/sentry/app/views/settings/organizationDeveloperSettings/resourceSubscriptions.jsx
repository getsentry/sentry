import PropTypes from 'prop-types';
import React from 'react';

import SubscriptionBox from 'app/views/settings/organizationDeveloperSettings/subscriptionBox';
import {
  EVENT_CHOICES,
  PERMISSIONS_MAP,
} from 'app/views/settings/organizationDeveloperSettings/constants';
import styled from 'react-emotion';

export default class Subscriptions extends React.Component {
  static contextTypes = {
    router: PropTypes.object.isRequired,
    form: PropTypes.object,
  };

  static propTypes = {
    permissions: PropTypes.object.isRequired,
    events: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {events: this.props.events};
  }

  componentDidUpdate(prevProps) {
    const {events} = this.state;
    const {permissions} = this.props;

    const permittedEvents = events.filter(resource => {
      return permissions[PERMISSIONS_MAP[resource]] !== 'no-access';
    });

    if (JSON.stringify(events) !== JSON.stringify(permittedEvents)) {
      this.save(permittedEvents);
    }
  }

  onChange = (resource, checked) => {
    const events = new Set(this.state.events);
    checked ? events.add(resource) : events.delete(resource);
    this.save(Array.from(events));
  };

  save = events => {
    this.setState({events});
    this.props.onChange(events);
    this.context.form.setValue('events', events);
  };

  render() {
    const {permissions} = this.props;
    const {events} = this.state;

    return (
      <SubscriptionGrid>
        {EVENT_CHOICES.map(choice => {
          const disabled = permissions[PERMISSIONS_MAP[choice]] === 'no-access';
          return (
            <React.Fragment key={choice}>
              <SubscriptionBox
                key={`${choice}${disabled}`}
                disabled={disabled}
                checked={events.includes(choice) && !disabled}
                resource={choice}
                onChange={this.onChange}
              />
            </React.Fragment>
          );
        })}
      </SubscriptionGrid>
    );
  }
}

const SubscriptionGrid = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;
