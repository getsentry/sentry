import {forwardRef} from 'react';
import styled from '@emotion/styled';

import Badge from 'sentry/components/badge/badge';
import type {DropdownButtonProps} from 'sentry/components/dropdownButton';
import DropdownButton from 'sentry/components/dropdownButton';
import PlatformList from 'sentry/components/platformList';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {trimSlug} from 'sentry/utils/string/trimSlug';

import {DesyncedFilterIndicator} from '../pageFilters/desyncedFilter';

interface ProjectPageFilterTriggerProps extends Omit<DropdownButtonProps, 'value'> {
  desynced: boolean;
  memberProjects: Project[];
  nonMemberProjects: Project[];
  ready: boolean;
  value: number[];
}

function BaseProjectPageFilterTrigger(
  {
    value,
    memberProjects,
    nonMemberProjects,
    ready,
    desynced,
    ...props
  }: ProjectPageFilterTriggerProps,
  forwardedRef: React.ForwardedRef<HTMLButtonElement>
) {
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
    selectedProjects[0]!?.slug?.length + selectedProjects[1]!?.slug?.length <= 23
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
      ref={forwardedRef}
      data-test-id="page-filter-project-selector"
      icon={
        ready &&
        !isAllProjectsSelected &&
        !isMyProjectsSelected && (
          <PlatformList
            platforms={projectsToShow.map(p => p.platform ?? 'other').reverse()}
          />
        )
      }
    >
      <TriggerLabelWrap>
        <TriggerLabel>{ready ? label : t('Loading\u2026')}</TriggerLabel>
        {desynced && <DesyncedFilterIndicator role="presentation" />}
      </TriggerLabelWrap>
      {remainingCount > 0 && <StyledBadge text={`+${remainingCount}`} />}
    </DropdownButton>
  );
}

export const ProjectPageFilterTrigger = forwardRef(BaseProjectPageFilterTrigger);

const TriggerLabelWrap = styled('span')`
  position: relative;
  min-width: 0;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis};
  position: relative;
  width: auto;
`;

const StyledBadge = styled(Badge)`
  margin-top: -${space(0.5)};
  margin-bottom: -${space(0.5)};
  flex-shrink: 0;
  top: auto;
`;
