import PropTypes from 'prop-types';
import React from 'react';

import SubscriptionBox from 'app/views/settings/organizationDeveloperSettings/subscriptionBox';
import {
  EVENT_CHOICES,
  PERMISSIONS_MAP,
} from 'app/views/settings/organizationDeveloperSettings/constants';
import {PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import styled from 'react-emotion';

export default class Subscriptions extends React.Component {
  static contextTypes = {
    router: PropTypes.object.isRequired,
    form: PropTypes.object,
  };

  static propTypes = {
    permissions: PropTypes.object,
    events: PropTypes.array,
  };

  static getDerivedStateFromProps(props, state) {
    if (props.events !== state.events) {
      return {
        events: props.events,
      };
    }
    return null;
  }

  constructor(...args) {
    super(...args);
    this.state = {
      events: this.props.events,
    };
  }

  onChange = (resource, checked) => {
    const events = new Set(this.state.events);
    checked ? events.add(resource) : events.delete(resource);
    const eventsArr = Array.from(events);
    this.setState({events: eventsArr});
    this.context.form.setValue('events', eventsArr);
  };

  renderBoxes() {
    const {permissions} = this.props;
    const {events} = this.state;
    return EVENT_CHOICES.map(choice => {
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
    });
  }

  render() {
    return (
      <React.Fragment>
        <PanelHeader>{t('Resource Subscriptions')}</PanelHeader>
        <PanelBody>
          <SubscriptionGrid>{this.renderBoxes()}</SubscriptionGrid>
        </PanelBody>
      </React.Fragment>
    );
  }
}

const SubscriptionGrid = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;
