import {RouteComponentProps} from 'react-router/lib/Router';
import {browserHistory} from 'react-router';

import {ProjectKey} from 'app/views/settings/project/projectKeys/types';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import KeySettings from 'app/views/settings/project/projectKeys/details/keySettings';
import KeyStats from 'app/views/settings/project/projectKeys/details/keyStats';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

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

  getEndpoints(): [string, string][] {
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
