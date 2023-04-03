import styled from '@emotion/styled';

import Checkbox from 'sentry/components/checkbox';
import FeatureBadge from 'sentry/components/featureBadge';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import {
  EVENT_CHOICES,
  PERMISSIONS_MAP,
} from 'sentry/views/settings/organizationDeveloperSettings/constants';

type Resource = (typeof EVENT_CHOICES)[number];

type Props = {
  checked: boolean;
  disabledFromPermissions: boolean;
  isNew: boolean;
  onChange: (resource: Resource, checked: boolean) => void;
  organization: Organization;
  resource: Resource;
  webhookDisabled?: boolean;
};

function SubscriptionBox({
  checked,
  disabledFromPermissions,
  isNew,
  onChange,
  organization,
  resource,
  webhookDisabled = false,
}: Props) {
  const {features} = organization;

  let disabled = disabledFromPermissions || webhookDisabled;
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

  if (webhookDisabled) {
    message = t('Cannot enable webhook subscription without specifying a webhook url');
  }

  const DESCRIPTIONS: Record<(typeof EVENT_CHOICES)[number], string> = {
    // Swap ignored for archived if the feature is enabled
    issue: `created, resolved, assigned, ${
      features.includes('escalating-issues') ? 'archived' : 'ignored'
    }`,
    error: 'created',
    comment: 'created, edited, deleted',
  };

  return (
    <Tooltip disabled={!disabled} title={message} key={resource}>
      <SubscriptionGridItem disabled={disabled}>
        <SubscriptionInfo>
          <SubscriptionTitle>
            {resource}
            {isNew && <FeatureBadge type="new" />}
          </SubscriptionTitle>
          <SubscriptionDescription>{DESCRIPTIONS[resource]}</SubscriptionDescription>
        </SubscriptionInfo>
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

export default withOrganization(SubscriptionBox);

const SubscriptionGridItem = styled('div')<{disabled: boolean}>`
  display: flex;
  justify-content: space-between;
  background: ${p => p.theme.backgroundSecondary};
  opacity: ${p => (p.disabled ? 0.3 : 1)};
  border-radius: ${p => p.theme.borderRadius};
  margin: ${space(1.5)};
  padding: ${space(1.5)};
  box-sizing: border-box;
`;

const SubscriptionInfo = styled('div')`
  display: flex;
  flex-direction: column;
  align-self: center;
`;

const SubscriptionDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1;
  color: ${p => p.theme.gray300};
`;

const SubscriptionTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  line-height: 1;
  color: ${p => p.theme.textColor};
  white-space: nowrap;
  margin-bottom: ${space(0.75)};
`;
