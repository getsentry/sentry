import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import Button from 'sentry/components/button';
import Field from 'sentry/components/forms/field';
import Link from 'sentry/components/links/link';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'sentry/components/panels';
import Switch from 'sentry/components/switchButton';
import Truncate from 'sentry/components/truncate';
import {IconAdd, IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, ServiceHook} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type RowProps = {
  hook: ServiceHook;
  onToggleActive: () => void;
  orgId: string;
  projectId: string;
};

function ServiceHookRow({orgId, projectId, hook, onToggleActive}: RowProps) {
  return (
    <Field
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
    </Field>
  );
}

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
};

type State = {
  hookList: null | ServiceHook[];
} & AsyncView['state'];

class ProjectServiceHooks extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId, projectId} = this.props.params;
    return [['hookList', `/projects/${orgId}/${projectId}/hooks/`]];
  }

  onToggleActive = (hook: ServiceHook) => {
    const {orgId, projectId} = this.props.params;
    const {hookList} = this.state;
    if (!hookList) {
      return;
    }

    addLoadingMessage(t('Saving changes\u2026'));

    this.api.request(`/projects/${orgId}/${projectId}/hooks/${hook.id}/`, {
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
    });
  };

  renderEmpty() {
    return (
      <EmptyMessage>
        {t('There are no service hooks associated with this project.')}
      </EmptyMessage>
    );
  }

  renderResults() {
    const {orgId, projectId} = this.props.params;

    return (
      <Fragment>
        <PanelHeader key="header">{t('Service Hook')}</PanelHeader>
        <PanelBody key="body">
          <PanelAlert type="info" icon={<IconFlag size="md" />}>
            {t(
              'Service Hooks are an early adopter preview feature and will change in the future.'
            )}
          </PanelAlert>
          {this.state.hookList?.map(hook => (
            <ServiceHookRow
              key={hook.id}
              orgId={orgId}
              projectId={projectId}
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

    const {orgId, projectId} = this.props.params;
    const access = new Set(this.props.organization.access);

    return (
      <Fragment>
        <SettingsPageHeader
          title={t('Service Hooks')}
          action={
            access.has('project:write') ? (
              <Button
                data-test-id="new-service-hook"
                to={`/settings/${orgId}/projects/${projectId}/hooks/new/`}
                size="small"
                priority="primary"
                icon={<IconAdd size="xs" isCircled />}
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
