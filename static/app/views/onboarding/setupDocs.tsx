import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {SdkDocumentation} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {platformToIntegrationMap} from 'sentry/utils/integrationUtil';
import {decodeList} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import SetupIntroduction from 'sentry/views/onboarding/components/setupIntroduction';
import {OtherPlatformsInfo} from 'sentry/views/projectInstall/otherPlatformsInfo';

import FirstEventFooter from './components/firstEventFooter';
import IntegrationSetup, {InstallationMode} from './integrationSetup';
import type {StepProps} from './types';

function SetupDocs({location, recentCreatedProject: project}: StepProps) {
  const organization = useOrganization();

  const products = useMemo<ProductSolution[]>(
    () => decodeList(location.query.product ?? []) as ProductSolution[],
    [location.query.product]
  );

  const currentPlatformKey = project?.platform ?? 'other';
  const currentPlatform =
    platforms.find(p => p.id === currentPlatformKey) ?? otherPlatform;

  if (!project || !currentPlatform) {
    return null;
  }

  const platformName = currentPlatform.name;
  const integrationSlug = project.platform && platformToIntegrationMap[project.platform];
  const showIntegrationOnboarding =
    integrationSlug && location.query.installationMode !== InstallationMode.MANUAL;

  return (
    <Fragment>
      <Wrapper>
        <MainContent>
          {showIntegrationOnboarding ? (
            <IntegrationSetup
              integrationSlug={integrationSlug}
              project={project}
              platform={currentPlatform}
            />
          ) : (
            <Fragment>
              <SetupIntroduction
                stepHeaderText={t('Configure %s SDK', platformName)}
                platform={currentPlatformKey}
              />
              {currentPlatformKey === 'other' ? (
                <OtherPlatformsInfo
                  projectSlug={project.slug}
                  platform={currentPlatform.name}
                />
              ) : (
                <SdkDocumentation
                  platform={currentPlatform}
                  organization={organization}
                  projectSlug={project.slug}
                  projectId={project.id}
                  activeProductSelection={products}
                  newOrg
                />
              )}
            </Fragment>
          )}
        </MainContent>
      </Wrapper>
      <FirstEventFooter
        project={project}
        organization={organization}
        isLast
        onClickSetupLater={() => {
          const orgIssuesURL = `/organizations/${organization.slug}/issues/?project=${project.id}&referrer=onboarding-setup-docs`;
          trackAnalytics('growth.onboarding_clicked_setup_platform_later', {
            organization,
            platform: currentPlatformKey,
            project_id: project.id,
          });
          browserHistory.push(orgIssuesURL);
        }}
      />
    </Fragment>
  );
}

export default SetupDocs;

const Wrapper = styled('div')`
  display: flex;
  flex-direction: row;
  margin: ${space(2)};
  justify-content: center;
`;

const MainContent = styled('div')`
  max-width: 850px;
  min-width: 0;
  flex-grow: 1;
`;
