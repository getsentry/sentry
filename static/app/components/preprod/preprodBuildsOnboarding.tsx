import {useEffect} from 'react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PreprodOnboardingPanel} from 'sentry/components/preprod/preprodOnboardingPanel';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';

type Props = {
  organization: Organization;
  projectId: string;
};

export function PreprodBuildsOnboarding({organization, projectId}: Props) {
  const project = ProjectsStore.getById(projectId);
  const platform = project?.platform;

  useEffect(() => {
    if (project) {
      trackAnalytics('preprod.builds.onboarding.viewed', {
        organization,
        platform,
        project_id: projectId,
      });
    }
  }, [organization, platform, project, projectId]);

  const handleDocsClick = (
    linkType: 'product' | 'ios' | 'android' | 'flutter' | 'react-native'
  ) => {
    trackAnalytics('preprod.builds.onboarding.docs_clicked', {
      organization,
      link_type: linkType,
      platform,
    });
  };

  if (!project) {
    return <LoadingIndicator />;
  }

  return (
    <PreprodOnboardingPanel platform={platform ?? null} onDocsClick={handleDocsClick} />
  );
}
