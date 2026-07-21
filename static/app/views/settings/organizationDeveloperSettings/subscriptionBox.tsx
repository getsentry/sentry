import styled from '@emotion/styled';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  EVENT_CHOICES,
  WebhookGranularEvent,
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
  onEventChange: (event: WebhookGranularEvent, checked: boolean) => void;
  resource: Resource;
  selectedEvents: WebhookGranularEvent[];
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

  if (
    resource === 'preprod_artifact' &&
    !features.includes('preprod-artifact-webhooks')
  ) {
    return null;
  }

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

  const granular = features.includes('sentry-apps-granular-events');
  const description = RESOURCE_EVENTS[resource].map(webhookEventLabel).join(', ');

  if (granular) {
    return (
      <SubscriptionRow
        align="start"
        gap="2xl"
        padding="lg md"
        direction={{'screen:xs': 'column', 'screen:md': 'row'}}
        data-disabled={disabled || undefined}
      >
        <Tooltip disabled={!disabled} title={message}>
          <Flex
            as="label"
            align="center"
            gap="md"
            flex="none"
            width={{'screen:xs': '100%', 'screen:md': '180px'}}
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

  return (
    <Tooltip disabled={!disabled} title={message} key={resource}>
      <SubscriptionGridItem disabled={disabled}>
        <Stack alignSelf="center">
          <SubscriptionTitle>
            {webhookResourceLabel(resource)}
            {isNew && <FeatureBadge type="new" />}
          </SubscriptionTitle>
          <SubscriptionDescription>{description}</SubscriptionDescription>
        </Stack>
        <Checkbox
          key={`${resource}${checked}`}
          aria-label={resource}
          disabled={disabled}
          id={resource}
          value={resource}
          checked={checked}
          onChange={evt => onChange(resource, evt.target.checked)}
        />
      </SubscriptionGridItem>
    </Tooltip>
  );
}

const SubscriptionGridItem = styled('div')<{disabled: boolean}>`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  background: ${p => p.theme.tokens.background.secondary};
  opacity: ${p => (p.disabled ? 0.6 : 1)};
  border-radius: ${p => p.theme.radius.md};
  cursor: ${p => (p.disabled ? 'not-allowed' : 'auto')};
  margin: ${p => p.theme.space.lg};
  padding: ${p => p.theme.space.lg};
  box-sizing: border-box;
`;

const SubscriptionRow = styled(Flex)`
  &[data-disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SubscriptionDescription = styled('div')`
  font-size: ${p => p.theme.font.size.md};
  line-height: 1;
  color: ${p => p.theme.tokens.content.secondary};
`;

const SubscriptionTitle = styled('div')`
  font-size: ${p => p.theme.font.size.lg};
  line-height: 1;
  color: ${p => p.theme.tokens.content.primary};
  white-space: nowrap;
  margin-bottom: ${p => p.theme.space.sm};
`;
