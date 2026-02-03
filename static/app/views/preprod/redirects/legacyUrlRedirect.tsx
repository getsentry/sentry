import {useEffect} from 'react';

import ConfigStore from 'sentry/stores/configStore';
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
  const project = useProjectFromSlug({organization, projectSlug: params.projectId});

  useEffect(() => {
    if (!project) {
      return;
    }

    const {artifactId, headArtifactId, baseArtifactId} = params;
    const numericProjectId = project.id;
    const isInstall = location.pathname.includes('/install/');
    const isCompare = location.pathname.includes('/compare/');

    const {customerDomain} = ConfigStore.getState();
    const orgPrefix = customerDomain ? '' : `/organizations/${organization.slug}`;

    let newPath = '';

    if (isCompare && headArtifactId) {
      const compareType = 'size';
      if (baseArtifactId) {
        newPath = `${orgPrefix}/preprod/${compareType}/compare/${headArtifactId}/${baseArtifactId}/?project=${numericProjectId}`;
      } else {
        newPath = `${orgPrefix}/preprod/${compareType}/compare/${headArtifactId}/?project=${numericProjectId}`;
      }
    } else if (isInstall && artifactId) {
      newPath = `${orgPrefix}/preprod/install/${artifactId}/?project=${numericProjectId}`;
    } else if (artifactId) {
      newPath = `${orgPrefix}/preprod/size/${artifactId}/?project=${numericProjectId}`;
    }

    if (newPath) {
      navigate(newPath, {replace: true});
    }
  }, [params, navigate, organization, location, project]);

  return null;
}
