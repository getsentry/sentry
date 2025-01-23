import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import FormContext from 'sentry/components/forms/formContext';
import type {Permissions, WebhookEvent} from 'sentry/types/integrations';
import {
  EVENT_CHOICES,
  PERMISSIONS_MAP,
} from 'sentry/views/settings/organizationDeveloperSettings/constants';
import SubscriptionBox from 'sentry/views/settings/organizationDeveloperSettings/subscriptionBox';

type Resource = (typeof EVENT_CHOICES)[number];

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

  constructor(props: Props, context: any) {
    super(props, context);
    this.context.form.setValue('events', this.props.events);
  }

  componentDidUpdate(prevProps: Props) {
    const {webhookDisabled, permissions, events} = this.props;

    const permittedEvents = events.filter(
      resource => permissions[PERMISSIONS_MAP[resource]] !== 'no-access'
    );

    // When disabling webhooks unset the events
    if (!prevProps.webhookDisabled && webhookDisabled && prevProps.events.length) {
      this.save([]);
      return;
    }

    if (JSON.stringify(events) !== JSON.stringify(permittedEvents)) {
      this.save(permittedEvents);
    }
  }

  declare context: Required<React.ContextType<typeof FormContext>>;
  static contextType = FormContext;

  onChange = (resource: Resource, checked: boolean) => {
    const events = new Set(this.props.events);
    if (checked) {
      events.add(resource);
    } else {
      events.delete(resource);
    }
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
                isNew={false}
              />
            </Fragment>
          );
        })}
      </SubscriptionGrid>
    );
  }
}

const SubscriptionGrid = styled('div')`
  display: grid;
  grid-template: auto / 1fr 1fr 1fr;
  @media (max-width: ${props => props.theme.breakpoints.large}) {
    grid-template: 1fr 1fr 1fr / auto;
  }
`;
