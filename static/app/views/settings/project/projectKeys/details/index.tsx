import {browserHistory, RouteComponentProps} from 'react-router';

import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';
import {KeySettings} from 'sentry/views/settings/project/projectKeys/details/keySettings';
import KeyStats from 'sentry/views/settings/project/projectKeys/details/keyStats';
import {ProjectKey} from 'sentry/views/settings/project/projectKeys/types';

type Props = {
  organization: Organization;
  project: Project;
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

  updateData = (data: ProjectKey) => {
    this.setState(state => {
      return {...state, data};
    });
  };

  renderBody() {
    const {organization, project, params} = this.props;
    const {data} = this.state;

    return (
      <div data-test-id="key-details">
        <SettingsPageHeader title={t('Key Details')} />
        <PermissionAlert project={project} />

        <KeyStats api={this.api} organization={organization} params={params} />

        <KeySettings
          data={data}
          updateData={this.updateData}
          onRemove={this.handleRemove}
          organization={organization}
          project={project}
          params={params}
        />
      </div>
    );
  }
}
