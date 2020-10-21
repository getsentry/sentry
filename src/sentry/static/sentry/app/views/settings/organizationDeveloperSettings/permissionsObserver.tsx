import PropTypes from 'prop-types';
import { Component, Fragment } from 'react';

import {toResourcePermissions} from 'app/utils/consolidatedScopes';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import PermissionSelection from 'app/views/settings/organizationDeveloperSettings/permissionSelection';
import Subscriptions from 'app/views/settings/organizationDeveloperSettings/resourceSubscriptions';
import {WebhookEvent, Permissions, Scope} from 'app/types';

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
  static propTypes = {
    scopes: PropTypes.arrayOf(PropTypes.string).isRequired,
    events: PropTypes.arrayOf(PropTypes.string).isRequired,
    webhookDisabled: PropTypes.bool.isRequired,
    appPublished: PropTypes.bool.isRequired,
  };

  static contextTypes = {
    router: PropTypes.object.isRequired,
    form: PropTypes.object,
  };

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
