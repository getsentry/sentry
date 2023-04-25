import styled from '@emotion/styled';

import Badge from 'sentry/components/badge';
import DropdownButton, {DropdownButtonProps} from 'sentry/components/dropdownButton';
import PlatformList from 'sentry/components/platformList';
import {IconProject} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {trimSlug} from 'sentry/utils/trimSlug';

interface ProjectPageFilterTriggerProps extends Omit<DropdownButtonProps, 'value'> {
  memberProjects: Project[];
  nonMemberProjects: Project[];
  ready: boolean;
  value: number[];
}

function ProjectPageFilterTrigger({
  value,
  memberProjects,
  nonMemberProjects,
  ready,
  ...props
}: ProjectPageFilterTriggerProps) {
  const isMemberProjectsSelected = memberProjects.every(p =>
    value.includes(parseInt(p.id, 10))
  );

  const isNonMemberProjectsSelected = nonMemberProjects.every(p =>
    value.includes(parseInt(p.id, 10))
  );

  const isMyProjectsSelected = isMemberProjectsSelected && memberProjects.length > 0;

  const isAllProjectsSelected =
    value.length === 0 || (isMyProjectsSelected && isNonMemberProjectsSelected);

  const selectedProjects = value
    .slice(0, 2) // we only need to know about the first two projects
    .map(val =>
      [...memberProjects, ...nonMemberProjects].find(p => String(p.id) === String(val))
    )
    .filter((p): p is Project => !!p);

  // Show 2 projects only if the combined string does not exceed maxTitleLength.
  // Otherwise show only 1 project.
  const projectsToShow =
    selectedProjects[0]?.slug?.length + selectedProjects[1]?.slug?.length <= 23
      ? selectedProjects.slice(0, 2)
      : selectedProjects.slice(0, 1);

  // e.g. "javascript, sentry"
  const enumeratedLabel = projectsToShow.map(proj => trimSlug(proj.slug, 25)).join(', ');

  const label = isAllProjectsSelected
    ? t('All Projects')
    : isMyProjectsSelected
    ? t('My Projects')
    : enumeratedLabel;

  // Number of projects that aren't listed in the trigger label
  const remainingCount = isAllProjectsSelected
    ? 0
    : isMyProjectsSelected
    ? value.length - memberProjects.length
    : value.length - projectsToShow.length;

  return (
    <DropdownButton
      {...props}
      icon={
        !ready || isAllProjectsSelected || isMyProjectsSelected ? (
          <IconProject />
        ) : (
          <PlatformList
            platforms={projectsToShow.map(p => p.platform ?? 'other').reverse()}
          />
        )
      }
    >
      <TriggerLabel>{ready ? label : t('Loading\u2026')}</TriggerLabel>
      {remainingCount > 0 && <StyledBadge text={`+${remainingCount}`} />}
    </DropdownButton>
  );
}

export {ProjectPageFilterTrigger};

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis};
  width: auto;
`;

const StyledBadge = styled(Badge)`
  margin-top: -${space(0.5)};
  margin-bottom: -${space(0.5)};
  flex-shrink: 0;
  top: auto;
`;
