import {RouteComponentProps} from 'react-router/lib/Router';
import { Fragment } from 'react';

import {
  addLoadingMessage,
  addErrorMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {Organization, Project} from 'app/types';
import {Panel} from 'app/components/panels';
import {ProjectKey} from 'app/views/settings/project/projectKeys/types';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ExternalLink from 'app/components/links/externalLink';
import Pagination from 'app/components/pagination';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import routeTitleGen from 'app/utils/routeTitle';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';
import {IconAdd, IconFlag} from 'app/icons';

import KeyRow from './keyRow';

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{orgId: string; projectId: string}, {}>;

type State = {
  keyList: ProjectKey[];
} & AsyncView['state'];

class ProjectKeys extends AsyncView<Props, State> {
  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Client Keys'), projectId, false);
  }

  getEndpoints(): [string, string][] {
    const {orgId, projectId} = this.props.params;
    return [['keyList', `/projects/${orgId}/${projectId}/keys/`]];
  }

  /**
   * Optimistically remove key
   */
  handleRemoveKey = async (data: ProjectKey) => {
    const oldKeyList = [...this.state.keyList];

    addLoadingMessage(t('Revoking key\u2026'));

    this.setState(state => ({
      keyList: state.keyList.filter(key => key.id !== data.id),
    }));

    const {orgId, projectId} = this.props.params;

    try {
      await this.api.requestPromise(`/projects/${orgId}/${projectId}/keys/${data.id}/`, {
        method: 'DELETE',
      });
      addSuccessMessage(t('Revoked key'));
    } catch (_err) {
      this.setState({
        keyList: oldKeyList,
      });
      addErrorMessage(t('Unable to revoke key'));
    }
  };

  handleToggleKey = async (isActive: boolean, data: ProjectKey) => {
    const oldKeyList = [...this.state.keyList];

    addLoadingMessage(t('Saving changes\u2026'));

    this.setState(state => {
      const keyList = state.keyList.map(key => {
        if (key.id === data.id) {
          return {
            ...key,
            isActive: !data.isActive,
          };
        }

        return key;
      });
      return {keyList};
    });

    const {orgId, projectId} = this.props.params;

    try {
      await this.api.requestPromise(`/projects/${orgId}/${projectId}/keys/${data.id}/`, {
        method: 'PUT',
        data: {isActive},
      });
      addSuccessMessage(isActive ? t('Enabled key') : t('Disabled key'));
    } catch (_err) {
      addErrorMessage(isActive ? t('Error enabling key') : t('Error disabling key'));
      this.setState({keyList: oldKeyList});
    }
  };

  handleCreateKey = async () => {
    const {orgId, projectId} = this.props.params;

    try {
      const data: ProjectKey = await this.api.requestPromise(
        `/projects/${orgId}/${projectId}/keys/`,
        {
          method: 'POST',
        }
      );

      this.setState(state => ({
        keyList: [...state.keyList, data],
      }));
      addSuccessMessage(t('Created a new key.'));
    } catch (_err) {
      addErrorMessage(t('Unable to create new key. Please try again.'));
    }
  };

  renderEmpty() {
    return (
      <Panel>
        <EmptyMessage
          icon={<IconFlag size="xl" />}
          description={t('There are no keys active for this project.')}
        />
      </Panel>
    );
  }

  renderResults() {
    const {location, organization, routes, params} = this.props;
    const {orgId, projectId} = params;
    const access = new Set(organization.access);

    return (
      <Fragment>
        {this.state.keyList.map(key => (
          <KeyRow
            api={this.api}
            access={access}
            key={key.id}
            orgId={orgId}
            projectId={`${projectId}`}
            data={key}
            onToggle={this.handleToggleKey}
            onRemove={this.handleRemoveKey}
            routes={routes}
            location={location}
            params={params}
          />
        ))}
        <Pagination pageLinks={this.state.keyListPageLinks} />
      </Fragment>
    );
  }

  renderBody() {
    const access = new Set(this.props.organization.access);
    const isEmpty = !this.state.keyList.length;

    return (
      <div data-test-id="project-keys">
        <SettingsPageHeader
          title={t('Client Keys')}
          action={
            access.has('project:write') ? (
              <Button
                onClick={this.handleCreateKey}
                size="small"
                priority="primary"
                icon={<IconAdd size="xs" isCircled />}
              >
                {t('Generate New Key')}
              </Button>
            ) : null
          }
        />
        <TextBlock>
          {tct(
            `To send data to Sentry you will need to configure an SDK with a client key
          (usually referred to as the [code:SENTRY_DSN] value). For more
          information on integrating Sentry with your application take a look at our
          [link:documentation].`,
            {
              link: <ExternalLink href="https://docs.sentry.io/" />,
              code: <code />,
            }
          )}
        </TextBlock>

        {isEmpty ? this.renderEmpty() : this.renderResults()}
      </div>
    );
  }
}

export default withOrganization(withProject(ProjectKeys));
