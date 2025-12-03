import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {SdkDocumentation} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeList} from 'sentry/utils/queryString';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SetupIntroduction from 'sentry/views/onboarding/components/setupIntroduction';
import {OtherPlatformsInfo} from 'sentry/views/projectInstall/otherPlatformsInfo';

import FirstEventFooter from './components/firstEventFooter';
import type {StepProps} from './types';

function SetupDocs({recentCreatedProject: project}: StepProps) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

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

  return (
    <Fragment>
      <Wrapper>
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
                activeProductSelection={products}
                newOrg
              />
            )}
          </Fragment>
        </MainContent>
      </Wrapper>
      <FirstEventFooter
        project={project}
        organization={organization}
        isLast
        onClickSetupLater={() => {
          trackAnalytics('growth.onboarding_clicked_setup_platform_later', {
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
