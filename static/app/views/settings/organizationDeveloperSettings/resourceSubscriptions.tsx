import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import type {Permissions, WebhookEvent} from 'sentry/types/integrations';
import {
  EVENT_CHOICES,
  PERMISSIONS_MAP,
} from 'sentry/views/settings/organizationDeveloperSettings/constants';
import {SubscriptionBox} from 'sentry/views/settings/organizationDeveloperSettings/subscriptionBox';

type Resource = (typeof EVENT_CHOICES)[number];

type Props = {
  events: WebhookEvent[];
  onChange: (events: WebhookEvent[]) => void;
  permissions: Permissions;
  webhookDisabled?: boolean;
};

export function Subscriptions({
  events,
  onChange,
  permissions,
  webhookDisabled = false,
}: Props) {
  // Keep the subscription consistent with the rest of the form: webhooks
  // disabled means no events, and every event needs its backing permission.
  useEffect(() => {
    if (webhookDisabled && events.length) {
      onChange([]);
      return;
    }

    const permittedEvents = events.filter(
      resource => permissions[PERMISSIONS_MAP[resource]] !== 'no-access'
    );

    if (JSON.stringify(events) !== JSON.stringify(permittedEvents)) {
      onChange(permittedEvents);
    }
  }, [webhookDisabled, permissions, events, onChange]);

  const handleChange = (resource: Resource, checked: boolean) => {
    const newEvents = new Set(events);
    if (checked) {
      newEvents.add(resource);
    } else {
      newEvents.delete(resource);
    }
    onChange(Array.from(newEvents));
  };

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
              onChange={handleChange}
              isNew={false}
            />
          </Fragment>
        );
      })}
    </SubscriptionGrid>
  );
}

const SubscriptionGrid = styled('div')`
  display: grid;
  grid-template: auto / 1fr 1fr 1fr;
  @media (max-width: ${props => props.theme.breakpoints.lg}) {
    grid-template: 1fr 1fr 1fr / auto;
  }
`;
