import {updateProjects} from 'sentry/actionCreators/pageFilters';
import {CompactSelect} from 'sentry/components/compactSelect';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {ALLOWED_PROJECT_IDS_FOR_ORG_SLUG} from 'sentry/views/starfish/allowedProjects';
import {STARFISH_PROJECT_KEY} from 'sentry/views/starfish/utils/constants';

export function StarfishProjectSelector() {
  const {projects, initiallyLoaded: projectsLoaded, fetchError} = useProjects();
  const organization = useOrganization();
  const router = useRouter();
  const location = useLocation();

  const [selectedProjectId, setSelectedProjectId] = useLocalStorageState(
    STARFISH_PROJECT_KEY,
    '1'
  );

  if (!projectsLoaded) {
    return (
      <CompactSelect
        disabled
        options={[{label: t('Loading\u2026'), value: 'loading'}]}
        defaultValue="loading"
      />
    );
  }

  if (fetchError) {
    throw new Error('Failed to fetch projects');
  }

  const allowedProjectIDs: string[] =
    ALLOWED_PROJECT_IDS_FOR_ORG_SLUG[organization.slug] ?? [];

  const projectOptions = projects
    .filter(project => allowedProjectIDs.includes(project.id))
    .map(project => ({
      label: <ProjectOptionLabel project={project} />,
      value: project.id,
    }));

  // const selectedOption =
  //   projectOptions.find(
  //     option => option.value === new String(selectedProjectId) ?? allowedProjectIDs[0]
  //   ) ?? projectOptions[0];

  const handleProjectChange = option => {
    updateProjects([option.value], router, {isStarfishPage: true, save: true});
    setSelectedProjectId(option.value);
    router.push({...location, query: {...location.query, project: option.value}});
  };

  return (
    <CompactSelect
      menuWidth={250}
      options={projectOptions}
      value={selectedProjectId}
      onChange={handleProjectChange}
    />
  );
}

function ProjectOptionLabel({project}: {project: Project}) {
  return <ProjectBadge project={project} avatarSize={20} disableLink />;
}
