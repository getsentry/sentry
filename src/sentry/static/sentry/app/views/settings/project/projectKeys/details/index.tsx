import React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import KeySettings from 'app/views/settings/project/projectKeys/details/keySettings';
import KeyStats from 'app/views/settings/project/projectKeys/details/keyStats';
import {ProjectKey} from 'app/views/settings/project/projectKeys/types';

type Props = RouteComponentProps<
  {
    keyId: string;
    orgId: string;
    projectId: string;
  },
  {}
>;

type State = {
  data: ProjectKey;
} & AsyncView['state'];

export default class ProjectKeyDetails extends AsyncView<Props, State> {
  getTitle() {
    return t('Key Details');
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {keyId, orgId, projectId} = this.props.params;
    return [['data', `/projects/${orgId}/${projectId}/keys/${keyId}/`]];
  }

  handleRemove = () => {
    const {orgId, projectId} = this.props.params;
    browserHistory.push(`/${orgId}/${projectId}/settings/keys/`);
  };

  renderBody() {
    const {data} = this.state;
    const {params} = this.props;

    return (
      <div data-test-id="key-details">
        <SettingsPageHeader title={t('Key Details')} />
        <PermissionAlert />

        <KeyStats api={this.api} params={params} />

        <KeySettings
          api={this.api}
          params={params}
          data={data}
          onRemove={this.handleRemove}
        />
      </div>
    );
  }
}
