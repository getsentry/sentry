import {useEffect} from 'react';
import styled from '@emotion/styled';

import {deleteUptimeRule} from 'sentry/actionCreators/uptime';
import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {UptimeAlertForm} from 'sentry/views/alerts/rules/uptime/uptimeAlertForm';
import {useUptimeRule} from 'sentry/views/insights/uptime/utils/useUptimeRule';

type RouteParams = {
  projectId: string;
  ruleId: string;
};

type Props = {
  onChangeTitle: (data: string) => void;
  organization: Organization;
  userTeamIds: string[];
} & RouteComponentProps<RouteParams>;

export function UptimeRulesEdit({params, onChangeTitle, organization}: Props) {
  const api = useApi();
  const navigate = useNavigate();

  const {
    isPending,
    isSuccess,
    isError,
    data: rule,
    error,
  } = useUptimeRule({projectSlug: params.projectId, detectorId: params.ruleId});

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
          <Alert variant="danger">{t('This alert rule could not be found.')}</Alert>
        </Alert.Container>
      );
    }

    return <LoadingError />;
  }

  const handleDelete = async () => {
    await deleteUptimeRule(api, organization, rule);
    navigate(makeAlertsPathname({path: `/rules/`, organization}));
  };

  return (
    <Main width="full">
      <UptimeAlertForm rule={rule} handleDelete={handleDelete} />
    </Main>
  );
}

const Main = styled(Layout.Main)`
  max-width: 1000px;
`;
