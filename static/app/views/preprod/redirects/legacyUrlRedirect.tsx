import {useEffect} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';

export default function LegacyPreprodRedirect() {
  const params = useParams<{
    projectId: string; // Note: Despite the name, this contains a project SLUG from the legacy URL
    artifactId?: string;
    baseArtifactId?: string;
    headArtifactId?: string;
  }>();
  const navigate = useNavigate();
  const organization = useOrganization();
  const location = useLocation();

  // Extract slug from route param (misnamed as "projectId" in the legacy route)
  const projectSlugFromUrl = params.projectId;

  const project = useProjectFromSlug({
    organization,
    projectSlug: projectSlugFromUrl,
  });

  useEffect(() => {
    const {artifactId, headArtifactId, baseArtifactId} = params;
    const isInstall = location.pathname.includes('/install/');
    const isCompare = location.pathname.includes('/compare/');

    // Prefer numeric project ID, fallback to slug if project not found
    const projectParam = project?.id ?? projectSlugFromUrl;

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
  }, [params, navigate, organization, location, project, projectSlugFromUrl]);

  return null;
}
