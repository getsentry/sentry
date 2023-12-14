import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Switch from 'sentry/components/switchButton';
import Truncate from 'sentry/components/truncate';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, ServiceHook} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type RowProps = {
  hook: ServiceHook;
  onToggleActive: () => void;
  orgId: string;
  projectId: string;
};

function ServiceHookRow({orgId, projectId, hook, onToggleActive}: RowProps) {
  return (
    <FieldGroup
      label={
        <Link
          data-test-id="project-service-hook"
          to={`/settings/${orgId}/projects/${projectId}/hooks/${hook.id}/`}
        >
          <Truncate value={hook.url} />
        </Link>
      }
      help={
        <small>
          {hook.events && hook.events.length !== 0 ? (
            hook.events.join(', ')
          ) : (
            <em>{t('no events configured')}</em>
          )}
        </small>
      }
    >
      <Switch isActive={hook.status === 'active'} size="lg" toggle={onToggleActive} />
    </FieldGroup>
  );
}

type Props = RouteComponentProps<{projectId: string}, {}> & {
  organization: Organization;
};

type State = {
  hookList: null | ServiceHook[];
} & DeprecatedAsyncView['state'];

class ProjectServiceHooks extends DeprecatedAsyncView<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {organization, params} = this.props;
    const projectId = params.projectId;
    return [['hookList', `/projects/${organization.slug}/${projectId}/hooks/`]];
  }

  onToggleActive = (hook: ServiceHook) => {
    const {organization, params} = this.props;
    const {hookList} = this.state;
    if (!hookList) {
      return;
    }

    addLoadingMessage(t('Saving changes\u2026'));

    this.api.request(
      `/projects/${organization.slug}/${params.projectId}/hooks/${hook.id}/`,
      {
        method: 'PUT',
        data: {
          isActive: hook.status !== 'active',
        },
        success: data => {
          clearIndicators();
          this.setState({
            hookList: hookList.map(h => {
              if (h.id === data.id) {
                return {
                  ...h,
                  ...data,
                };
              }
              return h;
            }),
          });
        },
        error: () => {
          addErrorMessage(t('Unable to remove application. Please try again.'));
        },
      }
    );
  };

  renderEmpty() {
    return (
      <EmptyMessage>
        {t('There are no service hooks associated with this project.')}
      </EmptyMessage>
    );
  }

  renderResults() {
    const {organization, params} = this.props;

    return (
      <Fragment>
        <PanelHeader key="header">{t('Service Hook')}</PanelHeader>
        <PanelBody key="body">
          <PanelAlert type="info" showIcon>
            {t(
              'Service Hooks are an early adopter preview feature and will change in the future.'
            )}
          </PanelAlert>
          {this.state.hookList?.map(hook => (
            <ServiceHookRow
              key={hook.id}
              orgId={organization.slug}
              projectId={params.projectId}
              hook={hook}
              onToggleActive={this.onToggleActive.bind(this, hook)}
            />
          ))}
        </PanelBody>
      </Fragment>
    );
  }

  renderBody() {
    const {hookList} = this.state;
    const body =
      hookList && hookList.length > 0 ? this.renderResults() : this.renderEmpty();

    const {organization, params} = this.props;

    return (
      <Fragment>
        <SettingsPageHeader
          title={t('Service Hooks')}
          action={
            organization.access.includes('project:write') ? (
              <Button
                data-test-id="new-service-hook"
                to={`/settings/${organization.slug}/projects/${params.projectId}/hooks/new/`}
                size="sm"
                priority="primary"
                icon={<IconAdd isCircled />}
              >
                {t('Create New Hook')}
              </Button>
            ) : null
          }
        />
        <Panel>{body}</Panel>
      </Fragment>
    );
  }
}
export default withOrganization(ProjectServiceHooks);
