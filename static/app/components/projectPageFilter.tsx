import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import partition from 'lodash/partition';

import {updateProjects} from 'sentry/actionCreators/pageFilters';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Badge from 'sentry/components/badge';
import PageFilterDropdownButton from 'sentry/components/organizations/pageFilters/pageFilterDropdownButton';
import PageFilterPinIndicator from 'sentry/components/organizations/pageFilters/pageFilterPinIndicator';
import ProjectSelector from 'sentry/components/organizations/projectSelector';
import PlatformList from 'sentry/components/platformList';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconProject} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {MinimalProject} from 'sentry/types';
import {trimSlug} from 'sentry/utils/trimSlug';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';

type ProjectSelectorProps = React.ComponentProps<typeof ProjectSelector>;

type Props = {
  disabled?: ProjectSelectorProps['disabled'];
  /**
   * Message to display at the bottom of project list
   */
  footerMessage?: React.ReactNode;

  /**
   * If a forced project is passed, selection is disabled
   */
  forceProject?: MinimalProject | null;

  /**
   * Subject that will be used in a tooltip that is shown on a lock icon hover
   * E.g. This 'issue' is unique to a project
   */
  lockedMessageSubject?: string;

  /**
   * Max character length for the dropdown title. Default is 25. This number
   * is used to determine how many projects to show, and how much to truncate.
   */
  maxTitleLength?: number;

  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];

  /**
   * A project will be forced from parent component (selection is disabled, and if user
   * does not have multi-project support enabled, it will not try to auto select a project).
   *
   * Project will be specified in the prop `forceProject` (since its data is async)
   */
  shouldForceProject?: boolean;

  /**
   * If true, there will be a back to issues stream icon link
   */
  showIssueStreamLink?: boolean;

  /**
   * If true, there will be a project settings icon link
   * (forceProject prop needs to be present to know the right project slug)
   */
  showProjectSettingsLink?: boolean;

  /**
   * Slugs of projects to restrict the project selector to
   */
  specificProjectSlugs?: string[];
};

const ProjectPageFilter = ({
  specificProjectSlugs,
  maxTitleLength = 25,
  resetParamsOnChange = [],
  disabled,
  ...otherProps
}: Props) => {
  const router = useRouter();

  const [currentSelectedProjects, setCurrentSelectedProjects] = useState<number[] | null>(
    null
  );
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const organization = useOrganization();
  const {selection, isReady, desyncedFilters} = usePageFilters();

  useEffect(
    () => {
      if (!isEqual(selection.projects, currentSelectedProjects)) {
        setCurrentSelectedProjects(selection.projects);
      }
    },
    // We only care to update the currentSelectedProjects when the project
    // selection has changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selection.projects]
  );

  const handleChangeProjects = (newProjects: number[]) => {
    setCurrentSelectedProjects(newProjects);
  };

  const handleApplyChange = (newProjects: number[]) => {
    updateProjects(newProjects, router, {
      save: true,
      resetParams: resetParamsOnChange,
      environments: [], // Clear environments when switching projects
    });
  };

  const specifiedProjects = specificProjectSlugs
    ? projects.filter(project => specificProjectSlugs.includes(project.slug))
    : projects;

  const [memberProjects, otherProjects] = partition(
    specifiedProjects,
    project => project.isMember
  );

  const {isSuperuser} = ConfigStore.get('user');
  const isOrgAdmin = organization.access.includes('org:admin');
  const nonMemberProjects = isSuperuser || isOrgAdmin ? otherProjects : [];

  const customProjectDropdown: ProjectSelectorProps['customDropdownButton'] = ({
    actions,
    selectedProjects,
    isOpen,
  }) => {
    const selectedProjectIds = new Set(selection.projects);
    const hasSelected = !!selectedProjects.length;

    // Show 2 projects only if the combined string does not exceed maxTitleLength.
    // Otherwise show only 1 project.
    const projectsToShow =
      selectedProjects[0]?.slug?.length + selectedProjects[1]?.slug?.length <=
      maxTitleLength - 2
        ? selectedProjects.slice(0, 2)
        : selectedProjects.slice(0, 1);

    const title = hasSelected
      ? projectsToShow.map(proj => trimSlug(proj.slug, maxTitleLength)).join(', ')
      : selectedProjectIds.has(ALL_ACCESS_PROJECTS)
      ? t('All Projects')
      : t('My Projects');

    const icon = hasSelected ? (
      <PlatformList
        platforms={projectsToShow.map(p => p.platform ?? 'other').reverse()}
      />
    ) : (
      <IconProject />
    );

    return (
      <GuideAnchor
        target="new_page_filter_button"
        position="bottom"
        onStepComplete={actions.open}
      >
        <PageFilterDropdownButton
          isOpen={isOpen}
          highlighted={desyncedFilters.has('projects')}
          data-test-id="page-filter-project-selector"
          disabled={disabled}
          icon={<PageFilterPinIndicator filter="projects">{icon}</PageFilterPinIndicator>}
        >
          <TitleContainer>{title}</TitleContainer>
          {selectedProjects.length > projectsToShow.length && (
            <StyledBadge text={`+${selectedProjects.length - projectsToShow.length}`} />
          )}
        </PageFilterDropdownButton>
      </GuideAnchor>
    );
  };

  const customLoadingIndicator = (
    <PageFilterDropdownButton
      icon={<IconProject />}
      showChevron={false}
      disabled
      data-test-id="page-filter-project-selector-loading"
    >
      <TitleContainer>{t('Loading\u2026')}</TitleContainer>
    </PageFilterDropdownButton>
  );

  return (
    <ProjectSelector
      organization={organization}
      memberProjects={memberProjects}
      isGlobalSelectionReady={projectsLoaded && isReady}
      nonMemberProjects={nonMemberProjects}
      value={currentSelectedProjects || selection.projects}
      onChange={handleChangeProjects}
      onApplyChange={handleApplyChange}
      customDropdownButton={customProjectDropdown}
      customLoadingIndicator={customLoadingIndicator}
      disabled={disabled}
      {...otherProps}
    />
  );
};

const TitleContainer = styled('span')`
  text-align: left;
  ${p => p.theme.overflowEllipsis}
`;

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
`;

export default ProjectPageFilter;
