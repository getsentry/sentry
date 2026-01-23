import {useEffect} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';

export default function LegacyPreprodRedirect() {
  const params = useParams<{
    projectId: string;
    artifactId?: string;
    baseArtifactId?: string;
    headArtifactId?: string;
  }>();
  const navigate = useNavigate();
  const organization = useOrganization();
  const location = useLocation();
  const project = useProjectFromSlug({
    organization,
    projectSlug: params.projectId,
  });

  useEffect(() => {
    const {projectId, artifactId, headArtifactId, baseArtifactId} = params;
    const isInstall = location.pathname.includes('/install/');
    const isCompare = location.pathname.includes('/compare/');

    // Use project ID if available, fallback to slug for backward compatibility
    const projectParam = project?.id ?? projectId;

    let newPath = '';

    if (isCompare && headArtifactId) {
      const compareType = 'size';
      if (baseArtifactId) {
        newPath = `/organizations/${organization.slug}/preprod/${compareType}/compare/${headArtifactId}/${baseArtifactId}/?project=${projectParam}`;
      } else {
        newPath = `/organizations/${organization.slug}/preprod/${compareType}/compare/${headArtifactId}/?project=${projectParam}`;
      }
    } else if (isInstall && artifactId) {
      newPath = `/organizations/${organization.slug}/preprod/install/${artifactId}/?project=${projectParam}`;
    } else if (artifactId) {
      newPath = `/organizations/${organization.slug}/preprod/size/${artifactId}/?project=${projectParam}`;
    }

    if (newPath) {
      navigate(newPath, {replace: true});
    }
  }, [params, navigate, organization, location, project]);

  return null;
}
