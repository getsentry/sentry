import {useCallback, useState} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import AutoSelectText from 'sentry/components/autoSelectText';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PlatformPicker, {PLATFORM_CATEGORIES} from 'sentry/components/platformPicker';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import recreateRoute from 'sentry/utils/recreateRoute';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {ProjectKey} from 'sentry/views/settings/project/projectKeys/types';

type Props = RouteComponentProps<{projectId: string}, {}>;

export function ProjectInstallOverview({params, routes, location}: Props) {
  const [showDsn, setShowDsn] = useState(false);
  const {projectId: projectSlug} = params;
  const organization = useOrganization();
  const {projects} = useProjects();

  const issueStreamLink = `/organizations/${organization.slug}/issues/#welcome`;
  const isGettingStarted = window.location.href.indexOf('getting-started') > 0;

  const project = projects.find(p => p.slug === projectSlug);
  const platform = project ? platforms.find(p => p.id === project.platform) : undefined;
  const category = PLATFORM_CATEGORIES.find(c =>
    c.platforms?.some(p => p === platform?.id)
  )?.id;

  const {
    data: keyList,
    isLoading,
    isError,
    refetch,
  } = useApiQuery<ProjectKey[]>([`/projects/${organization.slug}/${projectSlug}/keys/`], {
    staleTime: Infinity,
  });

  const redirectToDocs = useCallback(
    (platformKey: PlatformKey | null) => {
      const installUrl = isGettingStarted
        ? `/organizations/${organization.slug}/projects/${projectSlug}/getting-started/${platformKey}/`
        : recreateRoute(`${platformKey}/`, {
            routes,
            location,
            params,
            stepBack: -1,
          });

      browserHistory.push(normalizeUrl(installUrl));
    },
    [projectSlug, isGettingStarted, organization.slug, routes, location, params]
  );

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <div>
      <SentryDocumentTitle title={t('Instrumentation')} projectSlug={projectSlug} />
      <SettingsPageHeader title={t('Configure your application')} />
      <TextBlock>
        {t(
          'Get started by selecting the platform or language that powers your application.'
        )}
      </TextBlock>

      {showDsn ? (
        <DsnInfo>
          <DsnContainer>
            <strong>{t('DSN')}</strong>
            <DsnValue>
              <AutoSelectText>{keyList?.[0].dsn.public}</AutoSelectText>
            </DsnValue>
          </DsnContainer>

          <Button priority="primary" to={issueStreamLink}>
            {t('Got it! Take me to the Issue Stream.')}
          </Button>
        </DsnInfo>
      ) : (
        <p>
          <small>
            {tct('Already have things setup? [link:Get your DSN]', {
              link: (
                <Button
                  priority="link"
                  onClick={() => setShowDsn(!showDsn)}
                  aria-label={t('Get your DSN')}
                />
              ),
            })}
            .
          </small>
        </p>
      )}
      <PlatformPicker
        setPlatform={selectedPlatform => redirectToDocs(selectedPlatform?.id ?? null)}
        showOther={false}
        organization={organization}
        defaultCategory={category}
        platform={platform?.id}
      />
      <p>
        {tct(
          `For a complete list of client integrations, please see
             [docLink:our in-depth documentation].`,
          {docLink: <ExternalLink href="https://docs.sentry.io" />}
        )}
      </p>
    </div>
  );
}

const DsnValue = styled('code')`
  overflow: hidden;
`;

const DsnInfo = styled('div')`
  margin-bottom: ${space(3)};
`;

const DsnContainer = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1.5)} ${space(2)};
  align-items: center;
  margin-bottom: ${space(2)};
`;
