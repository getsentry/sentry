import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useQueryState} from 'nuqs';

import {Flex} from '@sentry/scraps/layout';

import {SdkDocumentation} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {otherPlatform, allPlatforms as platforms} from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {parseAsStringArray} from 'sentry/utils/url/parseAsStringArray';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {OtherPlatformsInfo} from 'sentry/views/projectInstall/otherPlatformsInfo';

import {FirstEventFooter} from './components/firstEventFooter';
import {SetupIntroduction} from './components/setupIntroduction';
import type {StepProps} from './types';

export function SetupDocs({recentCreatedProject: project, genBackButton}: StepProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {setSelectedFeatures} = useOnboardingContext();
  const [products] = useQueryState('product', parseAsStringArray);

  const currentPlatformKey = project?.platform ?? 'other';
  const currentPlatform =
    platforms.find(p => p.id === currentPlatformKey) ?? otherPlatform;

  if (!project || !currentPlatform) {
    return null;
  }

  return (
    <Fragment>
      <Flex justify="center" margin="xl">
        <MainContent>
          <Fragment>
            <SetupIntroduction
              stepHeaderText={t('Configure %s SDK', currentPlatform.name)}
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
                project={project}
                activeProductSelection={products as ProductSolution[]}
                onProductSelectionSync={setSelectedFeatures}
                docsFlow="onboarding-scm"
              />
            )}
          </Fragment>
        </MainContent>
      </Flex>
      <FirstEventFooter
        project={project}
        organization={organization}
        isLast
        leading={genBackButton?.()}
        onClickSetupLater={() => {
          trackAnalytics('onboarding.scm_setup_platform_later_clicked', {
            organization,
            platform: currentPlatformKey,
            project_id: project.id,
          });

          navigate(
            normalizeUrl({
              pathname: `/organizations/${organization.slug}/issues/`,
              query: {
                project: project.id,
                referrer: 'onboarding-setup-docs',
              },
            })
          );
        }}
      />
    </Fragment>
  );
}

const MainContent = styled('div')`
  max-width: 850px;
  min-width: 0;
  flex-grow: 1;
`;
