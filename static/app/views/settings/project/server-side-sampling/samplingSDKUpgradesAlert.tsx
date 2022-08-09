import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {RecommendedSdkUpgrade, SamplingRule} from 'sentry/types/sampling';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

import {
  RecommendedStepsModal,
  RecommendedStepsModalProps,
} from './modals/recommendedStepsModal';
import {isUniformRule, SERVER_SIDE_SAMPLING_DOC_LINK} from './utils';

type Props = Pick<RecommendedStepsModalProps, 'projectId' | 'onReadDocs'> & {
  incompatibleProjects: Project[];
  organization: Organization;
  recommendedSdkUpgrades: RecommendedSdkUpgrade[];
  rules: SamplingRule[];
  showLinkToTheModal?: boolean;
};

export function SamplingSDKUpgradesAlert({
  organization,
  projectId,
  recommendedSdkUpgrades,
  incompatibleProjects,
  rules,
  onReadDocs,
  showLinkToTheModal = true,
}: Props) {
  useEffect(() => {
    if (recommendedSdkUpgrades.length > 0) {
      trackAdvancedAnalyticsEvent('sampling.sdk.updgrades.alert', {
        organization,
        project_id: projectId,
      });
    }
  }, [recommendedSdkUpgrades.length, organization, projectId]);

  useEffect(() => {
    if (incompatibleProjects.length > 0) {
      trackAdvancedAnalyticsEvent('sampling.sdk.incompatible.alert', {
        organization,
        project_id: projectId,
      });
    }
  }, [incompatibleProjects.length, organization, projectId]);

  function handleOpenRecommendedSteps() {
    openModal(modalProps => (
      <RecommendedStepsModal
        {...modalProps}
        onReadDocs={onReadDocs}
        organization={organization}
        projectId={projectId}
        recommendedSdkUpgrades={recommendedSdkUpgrades}
      />
    ));
  }

  const uniformRule = rules.find(isUniformRule);

  return (
    <Fragment>
      {rules.length > 0 && recommendedSdkUpgrades.length > 0 && (
        <Alert
          data-test-id="recommended-sdk-upgrades-alert"
          type="info"
          showIcon
          trailingItems={
            showLinkToTheModal && uniformRule ? (
              <Button onClick={handleOpenRecommendedSteps} priority="link" borderless>
                {t('Learn More')}
              </Button>
            ) : undefined
          }
        >
          {t(
            'To activate server-side sampling rules, it’s a requirement to update the following project SDK(s):'
          )}
          <Projects>
            {recommendedSdkUpgrades.map(recommendedSdkUpgrade => (
              <ProjectBadge
                key={recommendedSdkUpgrade.project.id}
                project={recommendedSdkUpgrade.project}
                avatarSize={16}
              />
            ))}
          </Projects>
        </Alert>
      )}
      {incompatibleProjects.length > 0 && (
        <Alert
          data-test-id="incompatible-projects-alert"
          type="warning"
          showIcon
          trailingItems={
            showLinkToTheModal ? (
              <Button
                href={`${SERVER_SIDE_SAMPLING_DOC_LINK}getting-started/#current-limitations`}
                priority="link"
                borderless
                external
              >
                {t('Learn More')}
              </Button>
            ) : undefined
          }
        >
          {t(
            'The following projects are currently incompatible with Server-Side Sampling:'
          )}
          <Projects>
            {incompatibleProjects.map(incompatibleProject => (
              <ProjectBadge
                key={incompatibleProject.id}
                project={incompatibleProject}
                avatarSize={16}
              />
            ))}
          </Projects>
        </Alert>
      )}
    </Fragment>
  );
}

const Projects = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1.5)};
  justify-content: flex-start;
  margin-top: ${space(1)};
`;
