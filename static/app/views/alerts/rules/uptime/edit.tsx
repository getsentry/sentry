import {useEffect} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/core/alert/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {UptimeAlertForm} from 'sentry/views/alerts/rules/uptime/uptimeAlertForm';
import type {UptimeAlert} from 'sentry/views/alerts/types';

type RouteParams = {
  projectId: string;
  ruleId: string;
};

type Props = {
  onChangeTitle: (data: string) => void;
  organization: Organization;
  project: Project;
  userTeamIds: string[];
} & RouteComponentProps<RouteParams>;

export function UptimeRulesEdit({params, onChangeTitle, organization, project}: Props) {
  const api = useApi();
  const navigate = useNavigate();

  const apiUrl = `/projects/${organization.slug}/${params.projectId}/uptime/${params.ruleId}/`;

  const {
    isPending,
    isSuccess,
    isError,
    data: rule,
    error,
  } = useApiQuery<UptimeAlert>([apiUrl], {
    staleTime: 0,
    retry: false,
  });

  useEffect(() => {
    if (isSuccess && rule) {
      onChangeTitle(rule.name ?? '');
    }
  }, [onChangeTitle, isSuccess, rule]);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    if (error?.status === 404) {
      return (
        <Alert.Container>
          <Alert type="error" showIcon>
            {t('This alert rule could not be found.')}
          </Alert>
        </Alert.Container>
      );
    }

    return <LoadingError />;
  }

  const handleDelete = async () => {
    try {
      await api.requestPromise(apiUrl, {method: 'DELETE'});
      navigate(
        makeAlertsPathname({
          path: `/rules/`,
          organization,
        })
      );
    } catch (_err) {
      addErrorMessage(t('Error deleting rule'));
    }
  };

  return (
    <Main fullWidth>
      <UptimeAlertForm
        organization={organization}
        project={project}
        rule={rule}
        handleDelete={handleDelete}
      />
    </Main>
  );
}

const Main = styled(Layout.Main)`
  max-width: 1000px;
`;
