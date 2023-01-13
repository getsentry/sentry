import {type RouteComponentProps, browserHistory} from 'react-router';

import {t} from 'sentry/locale';
import {type Organization} from 'sentry/types';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';
import KeySettings from 'sentry/views/settings/project/projectKeys/details/keySettings';
import KeyStats from 'sentry/views/settings/project/projectKeys/details/keyStats';
import {type ProjectKey} from 'sentry/views/settings/project/projectKeys/types';

type Props = {
  organization: Organization;
} & RouteComponentProps<
  {
    keyId: string;
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
    const {organization} = this.props;
    const {keyId, projectId} = this.props.params;
    return [['data', `/projects/${organization.slug}/${projectId}/keys/${keyId}/`]];
  }

  handleRemove = () => {
    const {organization} = this.props;
    const {projectId} = this.props.params;
    browserHistory.push(
      normalizeUrl(`/settings/${organization.slug}/projects/${projectId}/keys/`)
    );
  };

  renderBody() {
    const {data} = this.state;
    const params = {
      ...this.props.params,
      orgId: this.props.organization.slug,
    };

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
