import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {tct} from 'sentry/locale';
import type {Permissions} from 'sentry/types/integrations';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  WebhookGranularEvent,
  WebhookSubscription,
} from 'sentry/views/settings/organizationDeveloperSettings/constants';
import {
  EVENT_CHOICES,
  PERMISSIONS_MAP,
  RESOURCE_EVENTS,
} from 'sentry/views/settings/organizationDeveloperSettings/constants';
import {SubscriptionBox} from 'sentry/views/settings/organizationDeveloperSettings/subscriptionBox';

type Resource = (typeof EVENT_CHOICES)[number];

type Props = {
  events: WebhookSubscription[];
  onChange: (events: WebhookSubscription[]) => void;
  permissions: Permissions;
  webhookDisabled?: boolean;
};

export function Subscriptions({
  events,
  onChange,
  permissions,
  webhookDisabled = false,
}: Props) {
  const organization = useOrganization();
  const granular = organization.features.includes('sentry-apps-granular-events');

  // Keep the subscription consistent with the rest of the form: webhooks
  // disabled means no events, and every event needs its backing permission.
  useEffect(() => {
    if (webhookDisabled && events.length) {
      onChange([]);
      return;
    }

    const permitted = new Set<string>(
      EVENT_CHOICES.filter(
        resource => permissions[PERMISSIONS_MAP[resource]] !== 'no-access'
      ).flatMap(resource => [resource, ...RESOURCE_EVENTS[resource]])
    );
    const permittedEvents = events.filter(subscription => permitted.has(subscription));

    if (JSON.stringify(events) !== JSON.stringify(permittedEvents)) {
      onChange(permittedEvents);
    }
  }, [webhookDisabled, permissions, events, onChange]);

  const handleResourceChange = (resource: Resource, checked: boolean) => {
    const owned = new Set<string>([resource, ...RESOURCE_EVENTS[resource]]);
    const others = events.filter(subscription => !owned.has(subscription));
    if (!checked) {
      onChange(others);
      return;
    }
    onChange([...others, ...(granular ? RESOURCE_EVENTS[resource] : [resource])]);
  };

  const handleEventChange = (event: WebhookGranularEvent, checked: boolean) => {
    const newEvents = new Set(events);
    if (checked) {
      newEvents.add(event);
    } else {
      newEvents.delete(event);
    }
    onChange(Array.from(newEvents));
  };

  const boxes = EVENT_CHOICES.map(choice => {
    const disabledFromPermissions = permissions[PERMISSIONS_MAP[choice]] === 'no-access';
    const selectedEvents = disabledFromPermissions
      ? []
      : RESOURCE_EVENTS[choice].filter(event => events.includes(event));

    let checked: boolean | 'indeterminate' = false;
    if (!disabledFromPermissions) {
      if (!granular) {
        checked = events.includes(choice);
      } else if (selectedEvents.length === RESOURCE_EVENTS[choice].length) {
        checked = true;
      } else if (selectedEvents.length > 0) {
        checked = 'indeterminate';
      }
    }

    return (
      <SubscriptionBox
        key={choice}
        disabledFromPermissions={disabledFromPermissions}
        webhookDisabled={webhookDisabled}
        checked={checked}
        selectedEvents={selectedEvents}
        resource={choice}
        onChange={handleResourceChange}
        onEventChange={handleEventChange}
        isNew={false}
      />
    );
  });

  if (!granular) {
    return <SubscriptionGrid>{boxes}</SubscriptionGrid>;
  }

  return (
    <SubscriptionList>
      <Container padding="lg md" maxWidth="80ch">
        <Text variant="muted">
          {tct(
            'Each time a subscribed event occurs, Sentry sends a POST request to the Webhook URL specified above. Subscribing requires at least Read access to the resource. See the [link:webhook documentation] for event payloads.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/integrations/integration-platform/webhooks/" />
              ),
            }
          )}
        </Text>
      </Container>
      {boxes}
    </SubscriptionList>
  );
}

const SubscriptionGrid = styled('div')`
  display: grid;
  grid-template: auto / 1fr 1fr 1fr;
  @media (max-width: ${props => props.theme.breakpoints.lg}) {
    grid-template: 1fr 1fr 1fr / auto;
  }
`;

const SubscriptionList = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${p => p.theme.space.md};

  > * + * {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;
