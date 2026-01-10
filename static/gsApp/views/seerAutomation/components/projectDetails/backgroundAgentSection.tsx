import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';

import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {useCodingAgentIntegrations} from 'sentry/components/events/autofix/useAutofix';
import Placeholder from 'sentry/components/placeholder';
import type {Project} from 'sentry/types/project';

import BackgroundAgentFields from 'getsentry/views/seerAutomation/components/projectDetails/backgroundAgentFields';
import BackgroundAgentSetup from 'getsentry/views/seerAutomation/components/projectDetails/backgroundAgentSetup';

interface Props {
  canWrite: boolean;
  isLoadingIntegrations: boolean;
  preference: ProjectSeerPreferences;
  project: Project;
  selectedIntegration: ReturnType<typeof useCodingAgentIntegrations>['data'] extends
    | {integrations: Array<infer T>}
    | undefined
    ? T | undefined
    : never;
  supportedIntegrations: NonNullable<
    ReturnType<typeof useCodingAgentIntegrations>['data']
  >['integrations'];
}

export default function BackgroundAgentSection({
  canWrite,
  project,
  preference,
  supportedIntegrations,
  selectedIntegration,
  isLoadingIntegrations,
}: Props) {
  if (isLoadingIntegrations) {
    return (
      <Flex justify="center" align="center" padding="xl">
        <Placeholder height="52px" />
      </Flex>
    );
  }

  return (
    <Fragment>
      {selectedIntegration ? (
        <BackgroundAgentFields
          canWrite={canWrite}
          project={project}
          preference={preference}
          selectedIntegration={selectedIntegration}
        />
      ) : null}
      <BackgroundAgentSetup supportedIntegrations={supportedIntegrations} />
    </Fragment>
  );
}
