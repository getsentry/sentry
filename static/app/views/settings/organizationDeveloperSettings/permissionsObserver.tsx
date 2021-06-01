import {Component, Fragment} from 'react';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import {Permissions, Scope, WebhookEvent} from 'app/types';
import {toResourcePermissions} from 'app/utils/consolidatedScopes';
import PermissionSelection from 'app/views/settings/organizationDeveloperSettings/permissionSelection';
import Subscriptions from 'app/views/settings/organizationDeveloperSettings/resourceSubscriptions';

type DefaultProps = {
  webhookDisabled: boolean;
  appPublished: boolean;
};

type Props = DefaultProps & {
  scopes: Scope[];
  events: WebhookEvent[];
};

type State = {
  permissions: Permissions;
  events: WebhookEvent[];
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
