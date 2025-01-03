import {Fragment} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd, IconFlag} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

import KeyRow from './keyRow';

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{projectId: string}, {}>;

type State = {
  keyList: ProjectKey[];
} & DeprecatedAsyncComponent['state'];

class ProjectKeys extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    const {projectId} = this.props.params;
    return [['keyList', `/projects/${organization.slug}/${projectId}/keys/`]];
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

    const {organization} = this.props;
    const {projectId} = this.props.params;

    try {
      await this.api.requestPromise(
        `/projects/${organization.slug}/${projectId}/keys/${data.id}/`,
        {
          method: 'DELETE',
        }
      );
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

    const {organization} = this.props;
    const {projectId} = this.props.params;

    try {
      await this.api.requestPromise(
        `/projects/${organization.slug}/${projectId}/keys/${data.id}/`,
        {
          method: 'PUT',
          data: {isActive},
        }
      );
      addSuccessMessage(isActive ? t('Enabled key') : t('Disabled key'));
    } catch (_err) {
      addErrorMessage(isActive ? t('Error enabling key') : t('Error disabling key'));
      this.setState({keyList: oldKeyList});
    }
  };

  handleCreateKey = async () => {
    const {organization} = this.props;
    const {projectId} = this.props.params;

    try {
      const data: ProjectKey = await this.api.requestPromise(
        `/projects/${organization.slug}/${projectId}/keys/`,
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
    const {location, organization, project, routes, params} = this.props;
    const {projectId} = params;
    const hasAccess = hasEveryAccess(['project:write'], {organization, project});

    return (
      <Fragment>
        {this.state.keyList.map(key => (
          <KeyRow
            hasWriteAccess={hasAccess}
            key={key.id}
            orgId={organization.slug}
            projectId={projectId}
            project={this.props.project}
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
    const {organization, project} = this.props;
    const isEmpty = !this.state.keyList.length;
    const hasAccess = hasEveryAccess(['project:write'], {organization, project});

    return (
      <div data-test-id="project-keys">
        <SentryDocumentTitle title={t('Client Keys')} projectSlug={project.slug} />
        <SettingsPageHeader
          title={t('Client Keys')}
          action={
            <Button
              onClick={this.handleCreateKey}
              size="sm"
              priority="primary"
              icon={<IconAdd isCircled />}
              disabled={!hasAccess}
            >
              {t('Generate New Key')}
            </Button>
          }
        />

        <TextBlock>
          {tct(
            `To send data to Sentry you will need to configure an SDK with a client key
          (usually referred to as the [code:SENTRY_DSN] value). For more
          information on integrating Sentry with your application take a look at our
          [link:documentation].`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=/configuration/options/" />
              ),
              code: <code />,
            }
          )}
        </TextBlock>

        <PermissionAlert project={project} />

        {isEmpty ? this.renderEmpty() : this.renderResults()}
      </div>
    );
  }
}

export default withOrganization(ProjectKeys);
