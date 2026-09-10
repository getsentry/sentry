import {Fragment, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useDisclosure} from '@react-aria/disclosure';
import {usePress} from '@react-aria/interactions';
import {useDisclosureState} from '@react-stately/disclosure';

import {Alert} from '@sentry/scraps/alert';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {CONTINUOUS_INTEGRATION_SENTRY_APP_PERMISSION} from 'sentry/constants';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Scope} from 'sentry/types/core';
import type {PermissionResource, Permissions} from 'sentry/types/integrations';
import {
  comparePermissionLevels,
  toResourcePermissions,
} from 'sentry/utils/consolidatedScopes';
import type {WebhookSubscription} from 'sentry/views/settings/organizationDeveloperSettings/constants';
import {
  PermissionSelection,
  permissionStateToList,
} from 'sentry/views/settings/organizationDeveloperSettings/permissionSelection';
import {Subscriptions} from 'sentry/views/settings/organizationDeveloperSettings/resourceSubscriptions';

type Props = {
  events: WebhookSubscription[];
  newApp: boolean;
  scopes: Scope[];
  appPublished?: boolean;
  collapsePanels?: boolean;
  continuousIntegrationError?: string;
  onEventsChange?: (events: WebhookSubscription[]) => void;
  onScopesChange?: (scopes: Scope[]) => void;
  permissionErrors?: Partial<Record<PermissionResource, string>>;
};

export function PermissionsObserver({
  appPublished = false,
  events: initialEvents,
  newApp,
  scopes,
  collapsePanels = false,
  continuousIntegrationError,
  onEventsChange,
  onScopesChange,
  permissionErrors = {},
}: Props) {
  const checkContinuousIntegration = () =>
    scopes.includes(CONTINUOUS_INTEGRATION_SENTRY_APP_PERMISSION.scope);

  const [permissions, setPermissions] = useState<Permissions>(() =>
    toResourcePermissions(scopes)
  );
  const [events, setEvents] = useState(initialEvents);
  const [hasContinuousIntegration, setHasContinuousIntegration] = useState<boolean>(() =>
    checkContinuousIntegration()
  );
  const [elevating, setElevating] = useState(false);
  const forcePermissionsExpanded = [
    continuousIntegrationError,
    ...Object.values(permissionErrors),
  ].some(Boolean);

  const handlePermissionChange = (
    newPermissions: Permissions,
    newHasContinuousIntegration: boolean
  ) => {
    setPermissions(newPermissions);
    setHasContinuousIntegration(newHasContinuousIntegration);
    onScopesChange?.(permissionStateToList(newPermissions, newHasContinuousIntegration));

    const originalPermissions = toResourcePermissions(scopes);

    let isElevating = false;
    Object.keys(newPermissions).some((resource_name: string) => {
      if (
        comparePermissionLevels(
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          newPermissions[resource_name],
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          originalPermissions[resource_name]
        ) > 0
      ) {
        isElevating = true;
        return true;
      }
      return false;
    });

    if (!isElevating && newHasContinuousIntegration && !checkContinuousIntegration()) {
      isElevating = true;
    }

    setElevating(isElevating);
  };

  const handleEventChange = (newEvents: WebhookSubscription[]) => {
    setEvents(newEvents);
    onEventsChange?.(newEvents);
  };

  const permissionsContent = (
    <Fragment>
      <PermissionSelection
        hasContinuousIntegration={hasContinuousIntegration}
        permissions={permissions}
        onChange={handlePermissionChange}
        appPublished={appPublished}
        errors={permissionErrors}
        continuousIntegrationError={continuousIntegrationError}
      />
      {!newApp && elevating && (
        <Alert.Container>
          <Alert variant="warning">
            {t(
              'You are going to increase privileges for this integration. Organization members who already had access to the Client Secret may gain extra permissions due to this change. If this is not what you are expecting, consider rotating the Client Secret below.'
            )}
          </Alert>
        </Alert.Container>
      )}
    </Fragment>
  );

  const permissionsPanel = collapsePanels ? (
    <CollapsiblePanel title={t('Permissions')} forceExpanded={forcePermissionsExpanded}>
      {permissionsContent}
    </CollapsiblePanel>
  ) : (
    <Panel>
      <PanelHeader>{t('Permissions')}</PanelHeader>
      <PanelBody>{permissionsContent}</PanelBody>
    </Panel>
  );

  const webhooksContent = (
    <Subscriptions
      permissions={permissions}
      events={events}
      onChange={handleEventChange}
    />
  );

  const webhooksPanel = collapsePanels ? (
    <CollapsiblePanel title={t('Webhooks')}>{webhooksContent}</CollapsiblePanel>
  ) : (
    <Panel>
      <PanelHeader>{t('Webhooks')}</PanelHeader>
      <PanelBody>{webhooksContent}</PanelBody>
    </Panel>
  );

  return (
    <Fragment>
      {permissionsPanel}
      {webhooksPanel}
    </Fragment>
  );
}

type CollapsiblePanelProps = {
  children: React.ReactNode;
  title: string;
  forceExpanded?: boolean;
};

/**
 * A disclosure that preserves the dimensions and typography of adjacent Panel headers.
 * The core Disclosure uses a different title and content layout.
 */
function CollapsiblePanel({
  children,
  title,
  forceExpanded = false,
}: CollapsiblePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isExpandedByUser, setIsExpandedByUser] = useState(false);
  const isExpanded = forceExpanded || isExpandedByUser;
  const disclosureProps = {
    isExpanded,
    onExpandedChange: setIsExpandedByUser,
  };
  const state = useDisclosureState(disclosureProps);
  const {buttonProps, panelProps} = useDisclosure(disclosureProps, state, panelRef);
  const {pressProps} = usePress(buttonProps);

  return (
    <Panel>
      <CollapsiblePanelHeader type="button" {...pressProps}>
        <Flex as="span" align="center" gap="md">
          <IconChevron direction={state.isExpanded ? 'down' : 'right'} size="xs" />
          <Text bold uppercase density="compressed" size="sm" variant="inherit">
            {title}
          </Text>
        </Flex>
      </CollapsiblePanelHeader>
      <PanelBody ref={panelRef} {...panelProps}>
        {children}
      </PanelBody>
    </Panel>
  );
}

const CollapsiblePanelHeader = styled('button')`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  appearance: none;
  padding: ${p => p.theme.space.xl};
  color: ${p => p.theme.tokens.content.primary};
  background: ${p => p.theme.tokens.background.secondary};
  border: 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: calc(${p => p.theme.radius.md} + 1px)
    calc(${p => p.theme.radius.md} + 1px) 0 0;
  position: relative;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &:active {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
  }

  &:focus-visible {
    ${p => p.theme.focusRing()};
    outline-offset: -2px;
  }

  &[aria-expanded='false'] {
    border-bottom: 0;
    border-radius: calc(${p => p.theme.radius.md} + 1px);
  }
`;
