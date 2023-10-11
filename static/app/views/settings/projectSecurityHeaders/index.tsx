import {useMemo} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {ProjectKey} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import recreateRoute from 'sentry/utils/recreateRoute';
import routeTitleGen from 'sentry/utils/routeTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import ReportUri from 'sentry/views/settings/projectSecurityHeaders/reportUri';

function ProjectSecurityHeaders() {
  const organization = useOrganization();
  const routes = useRoutes();
  const params = useParams();
  const {projectId} = useParams();

  const {
    data: keyList,
    isLoading,
    isError,
    refetch,
  } = useApiQuery<ProjectKey[]>([`/projects/${organization.slug}/${projectId}/keys/`], {
    staleTime: 0,
  });

  const reports = useMemo(
    () => [
      {
        name: 'Content Security Policy (CSP)',
        url: recreateRoute('csp/', {routes, params}),
      },
      {
        name: 'Certificate Transparency (Expect-CT)',
        url: recreateRoute('expect-ct/', {routes, params}),
      },
      {
        name: 'HTTP Public Key Pinning (HPKP)',
        url: recreateRoute('hpkp/', {routes, params}),
      },
    ],
    [routes, params]
  );

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <div>
      <SentryDocumentTitle
        title={routeTitleGen(t('Security Headers'), projectId, false)}
      />
      <SettingsPageHeader title={t('Security Header Reports')} />

      <ReportUri keyList={keyList} projectId={projectId} orgId={organization.slug} />

      <Panel>
        <PanelHeader>{t('Additional Configuration')}</PanelHeader>
        <PanelBody withPadding>
          <TextBlock style={{marginBottom: 20}}>
            {tct(
              'In addition to the [key_param] parameter, you may also pass the following within the querystring for the report URI:',
              {
                key_param: <code>sentry_key</code>,
              }
            )}
          </TextBlock>
          <KeyValueTable>
            <KeyValueTableRow
              keyName="sentry_environment"
              value={t('The environment name (e.g. production).')}
            />
            <KeyValueTableRow
              keyName="sentry_release"
              value={t('The version of the application.')}
            />
          </KeyValueTable>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>{t('Supported Formats')}</PanelHeader>
        <PanelBody>
          {reports.map(({name, url}) => (
            <ReportItem key={url}>
              <HeaderName>{name}</HeaderName>
              <LinkButton to={url} priority="primary">
                {t('Instructions')}
              </LinkButton>
            </ReportItem>
          ))}
        </PanelBody>
      </Panel>
    </div>
  );
}

export default ProjectSecurityHeaders;

const ReportItem = styled(PanelItem)`
  align-items: center;
  justify-content: space-between;
`;

const HeaderName = styled('span')`
  font-size: 1.2em;
`;
