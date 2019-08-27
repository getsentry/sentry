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
    webhookDisabled: PropTypes.bool.isRequired,
  };

  static defaultProps = {
    webhookDisabled: false,
  };

  constructor(...args) {
    super(...args);
    this.context.form.setValue('events', this.props.events);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.webhookDisabled && this.props.events.length) {
      this.save([]);
    }
  }

  componentDidUpdate() {
    const {permissions, events} = this.props;

    const permittedEvents = events.filter(resource => {
      return permissions[PERMISSIONS_MAP[resource]] !== 'no-access';
    });

    if (JSON.stringify(events) !== JSON.stringify(permittedEvents)) {
      this.save(permittedEvents);
    }
  }

  onChange = (resource, checked) => {
    const events = new Set(this.props.events);
    checked ? events.add(resource) : events.delete(resource);
    this.save(Array.from(events));
  };

  save = events => {
    this.props.onChange(events);
    this.context.form.setValue('events', events);
  };

  render() {
    const {permissions, webhookDisabled, events} = this.props;

    return (
      <SubscriptionGrid>
        {EVENT_CHOICES.map(choice => {
          const disabledFromPermissions =
            permissions[PERMISSIONS_MAP[choice]] === 'no-access';
          return (
            <React.Fragment key={choice}>
              <SubscriptionBox
                key={choice}
                disabledFromPermissions={disabledFromPermissions}
                webhookDisabled={webhookDisabled}
                checked={events.includes(choice) && !disabledFromPermissions}
                // checked={events.includes(choice)}
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
