import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import moment from 'moment';

import Alert from 'sentry/components/alert';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {FID_DEPRECATION_DATE} from 'sentry/views/performance/browser/webVitals/components/performanceScoreBreakdownChart';
import WebVitalMeters from 'sentry/views/performance/browser/webVitals/components/webVitalMeters';
import {PagePerformanceTable} from 'sentry/views/performance/browser/webVitals/pagePerformanceTable';
import {PerformanceScoreChart} from 'sentry/views/performance/browser/webVitals/performanceScoreChart';
import {calculatePerformanceScoreFromTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {useProjectRawWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useProjectRawWebVitalsQuery';
import {calculatePerformanceScoreFromStoredTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/calculatePerformanceScoreFromStored';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import type {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';
import {WebVitalsDetailPanel} from 'sentry/views/performance/browser/webVitals/webVitalsDetailPanel';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import Onboarding from 'sentry/views/performance/onboarding';

export default function WebVitalsLandingPage() {
  const organization = useOrganization();
  const location = useLocation();
  const onboardingProject = useOnboardingProject();
  const shouldUseStoredScores = useStoredScoresSetting();

  const router = useRouter();

  const [state, setState] = useState<{webVital: WebVitals | null}>({
    webVital: (location.query.webVital as WebVitals) ?? null,
  });

  const user = ConfigStore.get('user');

  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.slug}-${user.id}:fid-deprecation-message-dismissed`,
  });

  const {data: projectData, isLoading} = useProjectRawWebVitalsQuery({});
  const {data: projectScores, isLoading: isProjectScoresLoading} =
    useProjectWebVitalsScoresQuery({enabled: shouldUseStoredScores});

  const noTransactions = !isLoading && !projectData?.data?.[0]?.['count()'];

  const projectScore =
    (shouldUseStoredScores && isProjectScoresLoading) || isLoading || noTransactions
      ? undefined
      : shouldUseStoredScores
        ? calculatePerformanceScoreFromStoredTableDataRow(projectScores?.data?.[0])
        : calculatePerformanceScoreFromTableDataRow(projectData?.data?.[0]);

  const fidDeprecationTimestampString =
    moment(FID_DEPRECATION_DATE).format('DD MMMM YYYY');

  return (
    <ModulePageProviders
      title={[t('Performance'), t('Web Vitals')].join(' — ')}
      baseURL="/performance/browser/pageloads"
      features="starfish-browser-webvitals"
    >
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: 'Performance',
                to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                preservePageFilters: true,
              },
              {
                label: 'Web Vitals',
              },
            ]}
          />

          <Layout.Title>{t('Web Vitals')}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <FloatingFeedbackWidget />
        <Layout.Main fullWidth>
          <TopMenuContainer>
            <PageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter />
            </PageFilterBar>
          </TopMenuContainer>

          {onboardingProject && (
            <OnboardingContainer>
              <Onboarding organization={organization} project={onboardingProject} />
            </OnboardingContainer>
          )}
          {!onboardingProject && (
            <Fragment>
              {!isDismissed && (
                <StyledAlert type="info" showIcon>
                  <AlertContent>
                    <span>
                      {tct(
                        `Starting on [fidDeprecationTimestampString], [inpStrong:INP] (Interaction to Next Paint) will replace [fidStrong:FID] (First Input Delay) in Performance Score.`,
                        {
                          fidDeprecationTimestampString,
                          inpStrong: <strong />,
                          fidStrong: <strong />,
                        }
                      )}
                      <br />
                      {tct(
                        `Users should update their Sentry SDKs to the [link:latest version (7.105.0+)] and enable the INP option to start receiving updated Performance Scores.`,
                        {
                          link: (
                            <ExternalLink href="https://github.com/getsentry/sentry-javascript/releases/tag/7.105.0" />
                          ),
                        }
                      )}
                    </span>
                    <DismissButton
                      priority="link"
                      icon={<IconClose />}
                      onClick={dismiss}
                      aria-label={t('Dismiss Alert')}
                      title={t('Dismiss Alert')}
                    />
                  </AlertContent>
                </StyledAlert>
              )}
              <PerformanceScoreChartContainer>
                <PerformanceScoreChart
                  projectScore={projectScore}
                  isProjectScoreLoading={
                    isLoading || (shouldUseStoredScores && isProjectScoresLoading)
                  }
                  webVital={state.webVital}
                />
              </PerformanceScoreChartContainer>
              <WebVitalMetersContainer>
                <WebVitalMeters
                  projectData={projectData}
                  projectScore={projectScore}
                  onClick={webVital => setState({...state, webVital})}
                />
              </WebVitalMetersContainer>
              <PagePerformanceTable />
            </Fragment>
          )}
        </Layout.Main>
      </Layout.Body>
      <WebVitalsDetailPanel
        webVital={state.webVital}
        onClose={() => {
          router.replace({
            pathname: router.location.pathname,
            query: omit(router.location.query, 'webVital'),
          });
          setState({...state, webVital: null});
        }}
      />
    </ModulePageProviders>
  );
}

const TopMenuContainer = styled('div')`
  display: flex;
`;

const PerformanceScoreChartContainer = styled('div')`
  margin-bottom: ${space(1)};
`;

const OnboardingContainer = styled('div')`
  margin-top: ${space(2)};
`;

const WebVitalMetersContainer = styled('div')`
  margin-bottom: ${space(4)};
`;

export const AlertContent = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(1)};
  align-items: center;
`;

export const DismissButton = styled(Button)`
  color: ${p => p.theme.alert.info.iconColor};
  pointer-events: all;
  &:hover {
    color: ${p => p.theme.alert.info.iconHoverColor};
    opacity: 0.5;
  }
`;

export const StyledAlert = styled(Alert)`
  margin-top: ${space(2)};
`;
