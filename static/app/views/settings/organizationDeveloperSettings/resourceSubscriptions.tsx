import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {Context} from 'app/components/forms/form';
import {Permissions, WebhookEvent} from 'app/types';
import FormContext from 'app/views/settings/components/forms/formContext';
import {
  EVENT_CHOICES,
  PERMISSIONS_MAP,
} from 'app/views/settings/organizationDeveloperSettings/constants';
import SubscriptionBox from 'app/views/settings/organizationDeveloperSettings/subscriptionBox';

type Resource = typeof EVENT_CHOICES[number];

type DefaultProps = {
  webhookDisabled: boolean;
};

type Props = DefaultProps & {
  permissions: Permissions;
  events: WebhookEvent[];
  onChange: (events: WebhookEvent[]) => void;
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
