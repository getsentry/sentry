import {Component, Fragment} from 'react';

import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {Permissions, Scope, WebhookEvent} from 'sentry/types';
import {toResourcePermissions} from 'sentry/utils/consolidatedScopes';
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
