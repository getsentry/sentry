import {useEffect} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

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

  useEffect(() => {
    const {projectId, artifactId, headArtifactId, baseArtifactId} = params;
    const isInstall = location.pathname.includes('/install/');
    const isCompare = location.pathname.includes('/compare/');

    let newPath = '';

    if (isCompare && headArtifactId) {
      const compareType = 'size';
      if (baseArtifactId) {
        newPath = `/organizations/${organization.slug}/preprod/${compareType}/compare/${headArtifactId}/${baseArtifactId}/?project=${projectId}`;
      } else {
        newPath = `/organizations/${organization.slug}/preprod/${compareType}/compare/${headArtifactId}/?project=${projectId}`;
      }
    } else if (isInstall && artifactId) {
      newPath = `/organizations/${organization.slug}/preprod/install/${artifactId}/?project=${projectId}`;
    } else if (artifactId) {
      newPath = `/organizations/${organization.slug}/preprod/size/${artifactId}/?project=${projectId}`;
    }

    if (newPath) {
      navigate(newPath, {replace: true});
    }
  }, [params, navigate, organization, location]);

  return null;
}
