import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {SdkDocumentation} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {platformToIntegrationMap} from 'sentry/utils/integrationUtil';
import {decodeList} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import SetupIntroduction from 'sentry/views/onboarding/components/setupIntroduction';
import {SetupDocsLoader} from 'sentry/views/onboarding/setupDocsLoader';
import {OtherPlatformsInfo} from 'sentry/views/projectInstall/otherPlatformsInfo';

import FirstEventFooter from './components/firstEventFooter';
import IntegrationSetup from './integrationSetup';
import {StepProps} from './types';

function SetupDocs({location, recentCreatedProject: project}: StepProps) {
  const organization = useOrganization();

  const [integrationUseManualSetup, setIntegrationUseManualSetup] = useState(false);

  const products = useMemo<ProductSolution[]>(
    () => decodeList(location.query.product ?? []) as ProductSolution[],
    [location.query.product]
  );

  const currentPlatformKey = project?.platform ?? 'other';
  const currentPlatform =
    platforms.find(p => p.id === currentPlatformKey) ?? otherPlatform;

  const [showLoaderOnboarding, setShowLoaderOnboarding] = useState(
    currentPlatformKey === 'javascript'
  );

  useEffect(() => {
    setShowLoaderOnboarding(currentPlatformKey === 'javascript');
  }, [currentPlatformKey]);

  const hideLoaderOnboarding = useCallback(() => {
    setShowLoaderOnboarding(false);

    if (!project?.id) {
      return;
    }

    trackAnalytics('onboarding.js_loader_npm_docs_shown', {
      organization,
      platform: currentPlatformKey,
      project_id: project?.id,
    });
  }, [organization, currentPlatformKey, project?.id]);

  if (!project || !currentPlatform) {
    return null;
  }

  const platformName = currentPlatform?.name ?? '';
  const integrationSlug = project?.platform && platformToIntegrationMap[project.platform];
  const showIntegrationOnboarding = integrationSlug && !integrationUseManualSetup;

  return (
    <Fragment>
      <Wrapper>
        <MainContent>
          {showIntegrationOnboarding ? (
            <IntegrationSetup
              integrationSlug={integrationSlug}
              project={project}
              onClickManualSetup={() => {
                setIntegrationUseManualSetup(true);
              }}
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
              ) : showLoaderOnboarding ? (
                <SetupDocsLoader
                  organization={organization}
                  project={project}
                  location={location}
                  platform={currentPlatform.id}
                  close={hideLoaderOnboarding}
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

const AnimatedContentWrapper = styled(motion.div)`
  overflow: hidden;
`;

AnimatedContentWrapper.defaultProps = {
  initial: {
    height: 0,
  },
  animate: {
    height: 'auto',
  },
  exit: {
    height: 0,
  },
};

const DocsWrapper = styled(motion.div)``;

DocsWrapper.defaultProps = {
  initial: {opacity: 0, y: 40},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0},
};

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
