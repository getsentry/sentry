import {Component, Fragment} from 'react';

import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {Permissions, Scope, WebhookEvent} from 'sentry/types';
import {
  comparePermissionLevels,
  toResourcePermissions,
} from 'sentry/utils/consolidatedScopes';
import PermissionSelection from 'sentry/views/settings/organizationDeveloperSettings/permissionSelection';
import Subscriptions from 'sentry/views/settings/organizationDeveloperSettings/resourceSubscriptions';

type DefaultProps = {
  appPublished: boolean;
  webhookDisabled: boolean;
};

type Props = DefaultProps & {
  events: WebhookEvent[];
  scopes: Scope[];
};

type State = {
  events: WebhookEvent[];
  permissions: Permissions;
};

export default class PermissionsObserver extends Component<Props, State> {
  static defaultProps: DefaultProps = {
    webhookDisabled: false,
    appPublished: false,
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      permissions: this.scopeListToPermissionState(),
      events: this.props.events,
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

  onPermissionChange = (permissions: Permissions) => {
    this.setState({permissions});
    const new_permissions = toResourcePermissions(this.props.scopes);

    let elevating = false;
    Object.keys(permissions).some((resource_name: string) => {
      if (
        comparePermissionLevels(
          permissions[resource_name],
          new_permissions[resource_name]
        ) > 0
      ) {
        elevating = true;
        return true;
      }
      return false;
    });

    console.log('Elevating:', elevating);
    // TODO: if elevating === true, then add a confirmation dialog handler to the "Save Changes" button
  };

  onEventChange = (events: WebhookEvent[]) => {
    this.setState({events});
  };

  render() {
    const {permissions, events} = this.state;
    return (
      <Fragment>
        <Panel>
          <PanelHeader>{t('Permissions')}</PanelHeader>
          <PanelBody>
            <PermissionSelection
              permissions={permissions}
              onChange={this.onPermissionChange}
              appPublished={this.props.appPublished}
            />
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
