import styled from '@emotion/styled';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  EVENT_CHOICES,
  WebhookSubscription,
} from 'sentry/views/settings/organizationDeveloperSettings/constants';
import {
  PERMISSIONS_MAP,
  RESOURCE_EVENTS,
  webhookEventLabel,
  webhookResourceLabel,
} from 'sentry/views/settings/organizationDeveloperSettings/constants';

type Resource = (typeof EVENT_CHOICES)[number];

type Props = {
  checked: boolean | 'indeterminate';
  disabledFromPermissions: boolean;
  isNew: boolean;
  onChange: (resource: Resource, checked: boolean) => void;
  onEventChange: (event: WebhookSubscription, checked: boolean) => void;
  resource: Resource;
  selectedEvents: WebhookSubscription[];
};

export function SubscriptionBox({
  checked,
  disabledFromPermissions,
  isNew,
  onChange,
  onEventChange,
  resource,
  selectedEvents,
}: Props) {
  const {features} = useOrganization();

  let disabled = disabledFromPermissions;
  let message = t(
    "Must have at least 'Read' permissions enabled for %s",
    PERMISSIONS_MAP[resource]
  );

  if (resource === 'error' && !features.includes('integrations-event-hooks')) {
    disabled = true;
    message = t(
      'Your organization does not have access to the error subscription resource.'
    );
  }

  return (
    <SubscriptionRow
      align="start"
      gap="2xl"
      padding="lg md"
      direction={{zero: 'column', '2xl': 'row'}}
      data-disabled={disabled || undefined}
    >
      <Tooltip disabled={!disabled} title={message}>
        <Flex
          as="label"
          align="center"
          gap="md"
          flex="none"
          width={{zero: '100%', '2xl': '180px'}}
        >
          <Checkbox
            aria-label={resource}
            disabled={disabled}
            checked={checked}
            onChange={evt => onChange(resource, evt.target.checked)}
          />
          <Text size="md" bold>
            {webhookResourceLabel(resource)}
            {isNew && <FeatureBadge type="new" />}
          </Text>
        </Flex>
      </Tooltip>
      <Grid flex="1" columns="repeat(auto-fill, 220px)" gap="md lg">
        {RESOURCE_EVENTS[resource].map(event => (
          <Tooltip key={event} disabled={!disabled} title={message}>
            <Flex as="label" align="center" gap="sm">
              <Checkbox
                aria-label={event}
                disabled={disabled}
                checked={selectedEvents.includes(event)}
                onChange={evt => onEventChange(event, evt.target.checked)}
              />
              <Text size="md" variant="muted">
                {webhookEventLabel(event)}
              </Text>
            </Flex>
          </Tooltip>
        ))}
      </Grid>
    </SubscriptionRow>
  );
}

const SubscriptionRow = styled(Flex)`
  &[data-disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
