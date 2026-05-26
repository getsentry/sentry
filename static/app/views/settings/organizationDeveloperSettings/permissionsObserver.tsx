import {Component, Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {CONTINUOUS_INTEGRATION_SENTRY_APP_PERMISSION} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {Scope} from 'sentry/types/core';
import type {
  PermissionResource,
  Permissions,
  WebhookEvent,
} from 'sentry/types/integrations';
import {
  comparePermissionLevels,
  toResourcePermissions,
} from 'sentry/utils/consolidatedScopes';
import {
  PermissionSelection,
  permissionStateToList,
} from 'sentry/views/settings/organizationDeveloperSettings/permissionSelection';
import {Subscriptions} from 'sentry/views/settings/organizationDeveloperSettings/resourceSubscriptions';

type DefaultProps = {
  appPublished: boolean;
  webhookDisabled: boolean;
};

type Props = DefaultProps & {
  events: WebhookEvent[];
  newApp: boolean;
  scopes: Scope[];
  continuousIntegrationError?: string;
  onEventsChange?: (events: WebhookEvent[]) => void;
  onScopesChange?: (scopes: Scope[]) => void;
  permissionErrors?: Partial<Record<PermissionResource, string>>;
};

type State = {
  elevating: boolean;
  events: WebhookEvent[];
  hasContinuousIntegration: boolean;
  permissions: Permissions;
};

export class PermissionsObserver extends Component<Props, State> {
  static defaultProps: DefaultProps = {
    webhookDisabled: false,
    appPublished: false,
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      permissions: this.scopeListToPermissionState(),
      events: this.props.events,
      hasContinuousIntegration: this.hasContinuousIntegration(),
      elevating: false,
    };
  }

  /**
   * Converts the list of raw API scopes passed in to an object that can
   * before stored and used via `state`. This object is structured by
   * resource and holds "Permission" values. For example:
   *
   *    {
   *      'Project': 'read',
   *      ...,
   *    }
   *
   */
  scopeListToPermissionState() {
    return toResourcePermissions(this.props.scopes);
  }

  hasContinuousIntegration() {
    return this.props.scopes.includes(CONTINUOUS_INTEGRATION_SENTRY_APP_PERMISSION.scope);
  }

  onPermissionChange = (permissions: Permissions, hasContinuousIntegration: boolean) => {
    this.setState({permissions, hasContinuousIntegration});
    this.props.onScopesChange?.(
      permissionStateToList(permissions, hasContinuousIntegration)
    );
    const new_permissions = toResourcePermissions(this.props.scopes);

    let elevating = false;
    Object.keys(permissions).some((resource_name: string) => {
      if (
        comparePermissionLevels(
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          permissions[resource_name],
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          new_permissions[resource_name]
        ) > 0
      ) {
        elevating = true;
        return true;
      }
      return false;
    });

    if (!elevating && hasContinuousIntegration && !this.hasContinuousIntegration()) {
      elevating = true;
    }

    this.setState({elevating});
  };

  onEventChange = (events: WebhookEvent[]) => {
    this.setState({events});
    this.props.onEventsChange?.(events);
  };

  renderCallout() {
    const {elevating} = this.state;

    if (!this.props.newApp && elevating) {
      return (
        <Alert.Container>
          <Alert variant="warning">
            {t(
              'You are going to increase privileges for this integration. Organization members who already had access to the Client Secret may gain extra permissions due to this change. If this is not what you are expecting, consider rotating the Client Secret below.'
            )}
          </Alert>
        </Alert.Container>
      );
    }

    return null;
  }

  render() {
    const {hasContinuousIntegration, permissions, events} = this.state;

    return (
      <Fragment>
        <Panel>
          <PanelHeader>{t('Permissions')}</PanelHeader>
          <PanelBody>
            <PermissionSelection
              hasContinuousIntegration={hasContinuousIntegration}
              permissions={permissions}
              onChange={this.onPermissionChange}
              appPublished={this.props.appPublished}
              errors={this.props.permissionErrors}
              continuousIntegrationError={this.props.continuousIntegrationError}
            />
            {this.renderCallout()}
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader>{t('Webhooks')}</PanelHeader>
          <PanelBody>
            <Subscriptions
              permissions={permissions}
              events={events}
              onChange={this.onEventChange}
              webhookDisabled={this.props.webhookDisabled}
            />
          </PanelBody>
        </Panel>
      </Fragment>
    );
  }
}
