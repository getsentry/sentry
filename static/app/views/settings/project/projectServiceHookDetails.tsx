import {Fragment} from 'react';
import {browserHistory} from 'react-router';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import EmptyMessage from 'sentry/components/emptyMessage';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';
import {Organization, ServiceHook} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import ServiceHookSettingsForm from 'sentry/views/settings/project/serviceHookSettingsForm';

type Params = {
  hookId: string;
  projectId: string;
};

type StatsProps = {
  organization: Organization;
  params: Params;
};

type StatsState = {
  stats: {total: number; ts: number}[] | null;
} & DeprecatedAsyncComponent['state'];

class HookStats extends DeprecatedAsyncComponent<StatsProps, StatsState> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const until = Math.floor(new Date().getTime() / 1000);
    const since = until - 3600 * 24 * 30;
    const {organization} = this.props;
    const {hookId, projectId} = this.props.params;
    return [
      [
        'stats',
        `/projects/${organization.slug}/${projectId}/hooks/${hookId}/stats/`,
        {
          query: {
            since,
            until,
            resolution: '1d',
          },
        },
      ],
    ];
  }

  renderBody() {
    const {stats} = this.state;
    if (stats === null) {
      return null;
    }
    let emptyStats = true;

    const series = {
      seriesName: t('Events'),
      data: stats.map(p => {
        if (p.total) {
          emptyStats = false;
        }
        return {
          name: p.ts * 1000,
          value: p.total,
        };
      }),
    };

    return (
      <Panel>
        <PanelHeader>{t('Events in the last 30 days (by day)')}</PanelHeader>
        <PanelBody withPadding>
          {!emptyStats ? (
            <MiniBarChart
              isGroupedByDate
              showTimeInTooltip
              labelYAxisExtents
              series={[series]}
              height={150}
            />
          ) : (
            <EmptyMessage
              title={t('Nothing recorded in the last 30 days.')}
              description={t('Total webhooks fired for this configuration.')}
            />
          )}
        </PanelBody>
      </Panel>
    );
  }
}

type Props = {
  organization: Organization;
  params: Params;
};
type State = {
  hook: ServiceHook | null;
} & DeprecatedAsyncView['state'];

export default class ProjectServiceHookDetails extends DeprecatedAsyncView<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    const {projectId, hookId} = this.props.params;
    return [['hook', `/projects/${organization.slug}/${projectId}/hooks/${hookId}/`]];
  }

  onDelete = () => {
    const {organization} = this.props;
    const {projectId, hookId} = this.props.params;
    addLoadingMessage(t('Saving changes\u2026'));
    this.api.request(`/projects/${organization.slug}/${projectId}/hooks/${hookId}/`, {
      method: 'DELETE',
      success: () => {
        clearIndicators();
        browserHistory.push(
          normalizeUrl(`/settings/${organization.slug}/projects/${projectId}/hooks/`)
        );
      },
      error: () => {
        addErrorMessage(t('Unable to remove application. Please try again.'));
      },
    });
  };

  renderBody() {
    const {organization, params} = this.props;
    const {projectId, hookId} = params;
    const {hook} = this.state;
    if (!hook) {
      return null;
    }

    return (
      <Fragment>
        <SettingsPageHeader title={t('Service Hook Details')} />

        <ErrorBoundary>
          <HookStats params={params} organization={organization} />
        </ErrorBoundary>

        <ServiceHookSettingsForm
          organization={organization}
          projectId={projectId}
          hookId={hookId}
          initialData={{
            ...hook,
            isActive: hook.status !== 'disabled',
          }}
        />
        <Panel>
          <PanelHeader>{t('Event Validation')}</PanelHeader>
          <PanelBody>
            <PanelAlert type="info" showIcon>
              Sentry will send the <code>X-ServiceHook-Signature</code> header built using{' '}
              <code>HMAC(SHA256, [secret], [payload])</code>. You should always verify
              this signature before trusting the information provided in the webhook.
            </PanelAlert>
            <FieldGroup
              label={t('Secret')}
              flexibleControlStateSize
              inline={false}
              help={t('The shared secret used for generating event HMAC signatures.')}
            >
              <TextCopyInput>
                {getDynamicText({
                  value: hook.secret,
                  fixed: 'a dynamic secret value',
                })}
              </TextCopyInput>
            </FieldGroup>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader>{t('Delete Hook')}</PanelHeader>
          <PanelBody>
            <FieldGroup
              label={t('Delete Hook')}
              help={t('Removing this hook is immediate and permanent.')}
            >
              <div>
                <Button priority="danger" onClick={this.onDelete}>
                  {t('Delete Hook')}
                </Button>
              </div>
            </FieldGroup>
          </PanelBody>
        </Panel>
      </Fragment>
    );
  }
}
