import {Fragment, useState} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import EmptyMessage from 'sentry/components/emptyMessage';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';
import type {ServiceHook} from 'sentry/types/integrations';
import {useApiQuery, useMutation} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import ServiceHookSettingsForm from 'sentry/views/settings/project/serviceHookSettingsForm';

function HookStats() {
  const organization = useOrganization();
  const {hookId, projectId} = useParams<{hookId: string; projectId: string}>();

  const [until] = useState(() => Math.floor(new Date().getTime() / 1000));
  const since = until - 3600 * 24 * 30;

  const {
    data: stats,
    isPending,
    isError,
    refetch,
  } = useApiQuery<Array<{total: number; ts: number}>>(
    [
      `/projects/${organization.slug}/${projectId}/hooks/${hookId}/stats/`,
      {
        query: {
          since,
          until,
          resolution: '1d',
        },
      },
    ],
    {staleTime: 0}
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

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

export default function ProjectServiceHookDetails() {
  const organization = useOrganization();
  const {hookId, projectId} = useParams<{hookId: string; projectId: string}>();
  const api = useApi({persistInFlight: true});
  const navigate = useNavigate();

  const {
    data: hook,
    isPending,
    isError,
    refetch,
  } = useApiQuery<ServiceHook>(
    [`/projects/${organization.slug}/${projectId}/hooks/${hookId}/`],
    {staleTime: 0}
  );

  const deleteMutation = useMutation({
    mutationFn: () => {
      return api.requestPromise(
        `/projects/${organization.slug}/${projectId}/hooks/${hookId}/`,
        {
          method: 'DELETE',
        }
      );
    },
    onMutate: () => {
      addLoadingMessage(t('Saving changes\u2026'));
    },
    onSuccess: () => {
      clearIndicators();
      navigate(
        normalizeUrl(`/settings/${organization.slug}/projects/${projectId}/hooks/`)
      );
    },
    onError: () => {
      addErrorMessage(t('Unable to remove application. Please try again.'));
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (!hook) {
    return null;
  }

  return (
    <Fragment>
      <SettingsPageHeader title={t('Service Hook Details')} />

      <ErrorBoundary>
        <HookStats />
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
          <PanelAlert margin={false} type="info" showIcon>
            Sentry will send the <code>X-ServiceHook-Signature</code> header built using{' '}
            <code>HMAC(SHA256, [secret], [payload])</code>. You should always verify this
            signature before trusting the information provided in the webhook.
          </PanelAlert>
          <FieldGroup
            label={t('Secret')}
            flexibleControlStateSize
            inline={false}
            help={t('The shared secret used for generating event HMAC signatures.')}
          >
            <TextCopyInput>{hook.secret}</TextCopyInput>
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
              <Button priority="danger" onClick={() => deleteMutation.mutate()}>
                {t('Delete Hook')}
              </Button>
            </div>
          </FieldGroup>
        </PanelBody>
      </Panel>
    </Fragment>
  );
}
