import {useEffect} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {RecommendedSdkUpgrade, SamplingRule} from 'sentry/types/sampling';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

import {
  RecommendedStepsModal,
  RecommendedStepsModalProps,
} from './modals/recommendedStepsModal';
import {isUniformRule} from './utils';

type Props = Pick<RecommendedStepsModalProps, 'projectId' | 'onReadDocs'> & {
  organization: Organization;
  recommendedSdkUpgrades: RecommendedSdkUpgrade[];
  rules: SamplingRule[];
  showLinkToTheModal?: boolean;
};

export function SamplingSDKAlert({
  organization,
  projectId,
  recommendedSdkUpgrades,
  rules,
  onReadDocs,
  showLinkToTheModal = true,
}: Props) {
  useEffect(() => {
    if (recommendedSdkUpgrades.length === 0) {
      return;
    }

    trackAdvancedAnalyticsEvent('sampling.sdk.updgrades.alert', {
      organization,
      project_id: projectId,
    });
  }, [recommendedSdkUpgrades.length, organization, projectId]);

  if (recommendedSdkUpgrades.length === 0) {
    return null;
  }

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

  const atLeastOneRuleActive = rules.some(rule => rule.active);
  const uniformRule = rules.find(isUniformRule);

  return (
    <Alert
      data-test-id="recommended-sdk-upgrades-alert"
      type={atLeastOneRuleActive ? 'error' : 'info'}
      showIcon
      trailingItems={
        showLinkToTheModal && uniformRule ? (
          <Button onClick={handleOpenRecommendedSteps} priority="link" borderless>
            {atLeastOneRuleActive ? t('Resolve Now') : t('Learn More')}
          </Button>
        ) : undefined
      }
    >
      {atLeastOneRuleActive
        ? t(
            'Server-side sampling rules are in effect without the following SDK’s being updated to their latest version.'
          )
        : tn(
            'To keep a consistent amount of transactions across your applications multiple services, we recommend you update the SDK versions for the following project:',
            'To keep a consistent amount of transactions across your applications multiple services, we recommend you update the SDK versions for the following projects:',
            recommendedSdkUpgrades.length
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
