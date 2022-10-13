import {useEffect} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {RecommendedSdkUpgrade} from 'sentry/types/sampling';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

import {
  RecommendedStepsModal,
  RecommendedStepsModalProps,
} from './modals/recommendedStepsModal';

type Props = Pick<RecommendedStepsModalProps, 'projectId' | 'onReadDocs'> & {
  organization: Organization;
  recommendedSdkUpgrades: RecommendedSdkUpgrade[];
};

export function SamplingSDKUpgradesAlert({
  organization,
  projectId,
  recommendedSdkUpgrades,
  onReadDocs,
}: Props) {
  useEffect(() => {
    if (recommendedSdkUpgrades.length > 0) {
      trackAdvancedAnalyticsEvent('sampling.sdk.updgrades.alert', {
        organization,
        project_id: projectId,
      });
    }
  }, [recommendedSdkUpgrades.length, organization, projectId]);

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

  if (recommendedSdkUpgrades.length === 0) {
    return null;
  }

  return (
    <Alert
      data-test-id="recommended-sdk-upgrades-alert"
      type="info"
      showIcon
      trailingItems={
        <Button onClick={handleOpenRecommendedSteps} priority="link" borderless>
          {t('Learn More')}
        </Button>
      }
    >
      {t(
        'To activate sampling rules, it’s a requirement to update the following project SDK(s):'
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
  );
}

const Projects = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1.5)};
  justify-content: flex-start;
  margin-top: ${space(1)};
`;
