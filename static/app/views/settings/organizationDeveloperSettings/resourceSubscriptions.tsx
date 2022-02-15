import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {Context} from 'sentry/components/deprecatedforms/form';
import FormContext from 'sentry/components/forms/formContext';
import {Permissions, WebhookEvent} from 'sentry/types';
import {
  EVENT_CHOICES,
  PERMISSIONS_MAP,
} from 'sentry/views/settings/organizationDeveloperSettings/constants';
import SubscriptionBox from 'sentry/views/settings/organizationDeveloperSettings/subscriptionBox';

type Resource = typeof EVENT_CHOICES[number];

type DefaultProps = {
  webhookDisabled: boolean;
};

type Props = DefaultProps & {
  events: WebhookEvent[];
  onChange: (events: WebhookEvent[]) => void;
  permissions: Permissions;
};

export default class Subscriptions extends Component<Props> {
  static defaultProps: DefaultProps = {
    webhookDisabled: false,
  };

  constructor(props: Props, context: Context) {
    super(props, context);
    this.context.form.setValue('events', this.props.events);
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    // if webhooks are disabled, unset the events
    if (nextProps.webhookDisabled && this.props.events.length) {
      this.save([]);
    }
  }

  componentDidUpdate() {
    const {permissions, events} = this.props;

    const permittedEvents = events.filter(
      resource => permissions[PERMISSIONS_MAP[resource]] !== 'no-access'
    );

    if (JSON.stringify(events) !== JSON.stringify(permittedEvents)) {
      this.save(permittedEvents);
    }
  }

  static contextType = FormContext;

  onChange = (resource: Resource, checked: boolean) => {
    const events = new Set(this.props.events);
    checked ? events.add(resource) : events.delete(resource);
    this.save(Array.from(events));
  };

  save = (events: WebhookEvent[]) => {
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
            <Fragment key={choice}>
              <SubscriptionBox
                key={choice}
                disabledFromPermissions={disabledFromPermissions}
                webhookDisabled={webhookDisabled}
                checked={events.includes(choice) && !disabledFromPermissions}
                resource={choice}
                onChange={this.onChange}
              />
            </Fragment>
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
