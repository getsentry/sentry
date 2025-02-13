import {Fragment} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {LinkButton} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Switch from 'sentry/components/switchButton';
import Truncate from 'sentry/components/truncate';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {ServiceHook} from 'sentry/types/integrations';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import withOrganization from 'sentry/utils/withOrganization';
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

function ProjectServiceHooks() {
  const organization = useOrganization();
  const {projectId} = useParams<{projectId: string}>();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  const {
    data: hookList,
    isPending,
    isError,
    refetch,
  } = useApiQuery<ServiceHook[]>([`/projects/${organization.slug}/${projectId}/hooks/`], {
    staleTime: 0,
  });

  const onToggleActiveMutation = useMutation({
    mutationFn: ({hook}: {hook: ServiceHook}) => {
      return api.requestPromise(
        `/projects/${organization.slug}/${projectId}/hooks/${hook.id}/`,
        {
          method: 'PUT',
          data: {
            isActive: hook.status !== 'active',
          },
        }
      );
    },
    onMutate: () => {
      addLoadingMessage(t('Saving changes\u2026'));
    },
    onSuccess: data => {
      clearIndicators();
      setApiQueryData<ServiceHook[]>(
        queryClient,
        [`/projects/${organization.slug}/${projectId}/hooks/`],
        oldHookList => {
          return oldHookList.map(h => {
            if (h.id === data.id) {
              return {
                ...h,
                ...data,
              };
            }
            return h;
          });
        }
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

  const renderEmpty = () => {
    return (
      <EmptyMessage>
        {t('There are no service hooks associated with this project.')}
      </EmptyMessage>
    );
  };

  const renderResults = () => {
    return (
      <Fragment>
        <PanelHeader key="header">{t('Service Hook')}</PanelHeader>
        <PanelBody key="body">
          <PanelAlert margin={false} type="info" showIcon>
            {t(
              'Service Hooks are an early adopter preview feature and will change in the future.'
            )}
          </PanelAlert>
          {hookList?.map(hook => (
            <ServiceHookRow
              key={hook.id}
              orgId={organization.slug}
              projectId={projectId}
              hook={hook}
              onToggleActive={() => onToggleActiveMutation.mutate({hook})}
            />
          ))}
        </PanelBody>
      </Fragment>
    );
  };

  const body = hookList && hookList.length > 0 ? renderResults() : renderEmpty();

  return (
    <Fragment>
      <SettingsPageHeader
        title={t('Service Hooks')}
        action={
          organization.access.includes('project:write') ? (
            <LinkButton
              data-test-id="new-service-hook"
              to={`/settings/${organization.slug}/projects/${projectId}/hooks/new/`}
              size="sm"
              priority="primary"
              icon={<IconAdd isCircled />}
            >
              {t('Create New Hook')}
            </LinkButton>
          ) : null
        }
      />
      <Panel>{body}</Panel>
    </Fragment>
  );
}

export default withOrganization(ProjectServiceHooks);
