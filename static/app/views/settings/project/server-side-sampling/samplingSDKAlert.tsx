import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {RecommendedSdkUpgrade, SamplingRule} from 'sentry/types/sampling';

import {RecommendedStepsModal} from './modals/recommendedStepsModal';

type Props = {
  organization: Organization;
  recommendedSdkUpgrades: RecommendedSdkUpgrade[];
  rules: SamplingRule[];
  project?: Project;
  showLinkToTheModal?: boolean;
};

export function SamplingSDKAlert({
  organization,
  project,
  recommendedSdkUpgrades,
  rules,
  showLinkToTheModal = true,
}: Props) {
  if (recommendedSdkUpgrades.length === 0) {
    return null;
  }

  function handleOpenRecommendedSteps() {
    openModal(modalProps => (
      <RecommendedStepsModal
        {...modalProps}
        organization={organization}
        project={project}
        recommendedSdkUpgrades={recommendedSdkUpgrades}
        onSubmit={() => {}}
      />
    ));
  }

  // TODO(sampling): test this after the backend work is finished
  const atLeastOneRuleActive = rules.some(rule => rule.active);

  return (
    <Alert
      data-test-id="recommended-sdk-upgrades-alert"
      type={atLeastOneRuleActive ? 'error' : 'info'}
      showIcon
      trailingItems={
        showLinkToTheModal ? (
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
        : t(
            'To keep a consistent amount of transactions across your applications multiple services, we recommend you update the SDK versions for the following projects:'
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
