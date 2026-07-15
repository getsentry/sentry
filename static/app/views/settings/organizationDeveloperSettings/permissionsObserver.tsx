import {Fragment, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {CONTINUOUS_INTEGRATION_SENTRY_APP_PERMISSION} from 'sentry/constants';
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
  continuousIntegrationError?: string;
  onEventsChange?: (events: WebhookSubscription[]) => void;
  onScopesChange?: (scopes: Scope[]) => void;
  permissionErrors?: Partial<Record<PermissionResource, string>>;
  webhookDisabled?: boolean;
};

export function PermissionsObserver({
  appPublished = false,
  webhookDisabled = false,
  events: initialEvents,
  newApp,
  scopes,
  continuousIntegrationError,
  onEventsChange,
  onScopesChange,
  permissionErrors,
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

  return (
    <Fragment>
      <Panel>
        <PanelHeader>{t('Permissions')}</PanelHeader>
        <PanelBody>
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
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader>{t('Webhooks')}</PanelHeader>
        <PanelBody>
          <Subscriptions
            permissions={permissions}
            events={events}
            onChange={handleEventChange}
            webhookDisabled={webhookDisabled}
          />
        </PanelBody>
      </Panel>
    </Fragment>
  );
}
