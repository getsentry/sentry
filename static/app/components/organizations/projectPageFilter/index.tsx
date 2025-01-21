import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import partition from 'lodash/partition';
import sortBy from 'lodash/sortBy';

import {updateProjects} from 'sentry/actionCreators/pageFilters';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {LinkButton} from 'sentry/components/button';
import type {SelectOption, SelectOptionOrSection} from 'sentry/components/compactSelect';
import {Hovercard} from 'sentry/components/hovercard';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import type {HybridFilterProps} from 'sentry/components/organizations/hybridFilter';
import {HybridFilter} from 'sentry/components/organizations/hybridFilter';
import BookmarkStar from 'sentry/components/projects/bookmarkStar';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconOpen, IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {useRoutes} from 'sentry/utils/useRoutes';
import {useUser} from 'sentry/utils/useUser';

import {DesyncedFilterMessage} from '../pageFilters/desyncedFilter';

import {ProjectPageFilterMenuFooter} from './menuFooter';
import {ProjectPageFilterTrigger} from './trigger';

export interface ProjectPageFilterProps
  extends Partial<
    Omit<
      HybridFilterProps<number>,
      | 'searchable'
      | 'multiple'
      | 'options'
      | 'value'
      | 'defaultValue'
      | 'onReplace'
      | 'onToggle'
      | 'menuBody'
      | 'menuFooter'
      | 'menuFooterMessage'
      | 'checkboxWrapper'
      | 'shouldCloseOnInteractOutside'
    >
  > {
  /**
   * Message to show in the menu footer
   */
  footerMessage?: React.ReactNode;
  /**
   * This overrides the selected projects that is DISPLAYED by
   * the project select.
   *
   * Use this when you want to display a disabled project selector
   * with a fixed set of projects. For example, if you always want
   * it to show `All Projects`.
   *
   * It does NOT override the projects in the store, so hooks like
   * `usePageFilters` will not reflect this override.
   */
  projectOverride?: number[];
  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
}

/**
 * Maximum number of projects that can be selected at a time (due to server limits). This
 * does not apply to special values like "My Projects" and "All Projects".
 */
const SELECTION_COUNT_LIMIT = 50;

export function ProjectPageFilter({
  onChange,
  onReset,
  disabled,
  sizeLimit,
  sizeLimitMessage,
  emptyMessage,
  menuTitle,
  menuWidth,
  trigger,
  projectOverride,
  resetParamsOnChange,
  footerMessage,
  ...selectProps
}: ProjectPageFilterProps) {
  const user = useUser();
  const router = useRouter();
  const routes = useRoutes();
  const organization = useOrganization();

  const allowMultiple = organization.features.includes('global-views');

  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const [memberProjects, otherProjects] = useMemo(
    () => partition(projects, project => project.isMember),
    [projects]
  );

  const showNonMemberProjects = useMemo(() => {
    const isOrgAdminOrManager =
      organization.orgRole === 'owner' || organization.orgRole === 'manager';
    const isOpenMembership = organization.features.includes('open-membership');

    return user.isSuperuser || isOrgAdminOrManager || isOpenMembership;
  }, [user, organization.orgRole, organization.features]);

  const nonMemberProjects = useMemo(
    () => (showNonMemberProjects ? otherProjects : []),
    [otherProjects, showNonMemberProjects]
  );

  const {
    selection: {projects: pageFilterValue},
    isReady: pageFilterIsReady,
    desyncedFilters,
  } = usePageFilters();

  /**
   * Transforms a plain array of project IDs into values that can be used as page filter
   * URL parameters. This is necessary because some configurations have special URL
   * values: "My Projects" = [] and "All Projects" = [-1].
   */
  const mapNormalValueToURLValue = useCallback(
    (val: number[]) => {
      const memberProjectsSelected = memberProjects.every(p =>
        val.includes(parseInt(p.id, 10))
      );

      // "All Projects"
      if (!val.length) {
        return [ALL_ACCESS_PROJECTS];
      }

      // "My Projects"
      if (
        showNonMemberProjects &&
        memberProjectsSelected &&
        val.length === memberProjects.length
      ) {
        return [];
      }

      return val;
    },
    [memberProjects, showNonMemberProjects]
  );

  /**
   * Transforms an array of page filter URL parameters into a plain array of project
   * IDs. This is necessary because some URL values denote special configurations: [] =
   * "My Projects" and [-1] = "All Projects".
   */
  const mapURLValueToNormalValue = useCallback(
    (val: number[]) => {
      // "All Projects"
      if (val.includes(ALL_ACCESS_PROJECTS)) {
        return [];
      }

      // "My Projects"
      if (!val.length) {
        return allowMultiple
          ? memberProjects.map(p => parseInt(p.id, 10))
          : [parseInt(memberProjects[0]?.id!, 10)];
      }

      return allowMultiple ? val : [val[0]!];
    },
    [memberProjects, allowMultiple]
  );

  const value = useMemo<number[]>(
    () => mapURLValueToNormalValue(projectOverride ?? pageFilterValue),
    [mapURLValueToNormalValue, pageFilterValue, projectOverride]
  );

  const defaultValue = useMemo<number[]>(
    () => mapURLValueToNormalValue(projectOverride ?? []),
    [mapURLValueToNormalValue, projectOverride]
  );

  const handleChange = useCallback(
    async (newValue: number[]) => {
      if (isEqual(newValue, value)) {
        return;
      }

      onChange?.(newValue);

      trackAnalytics('projectselector.update', {
        count: newValue.length,
        path: getRouteStringFromRoutes(routes),
        organization,
        multi: allowMultiple,
      });

      // Wait for the menu to close before calling onChange
      await new Promise(resolve => setTimeout(resolve, 0));

      updateProjects(mapNormalValueToURLValue(newValue), router, {
        save: true,
        resetParams: resetParamsOnChange,
        environments: [], // Clear environments when switching projects
      });
    },
    [
      value,
      resetParamsOnChange,
      router,
      allowMultiple,
      organization,
      routes,
      onChange,
      mapNormalValueToURLValue,
    ]
  );

  const onToggle = useCallback(
    (newValue: any) => {
      trackAnalytics('projectselector.toggle', {
        action: newValue.length > value.length ? 'added' : 'removed',
        path: getRouteStringFromRoutes(routes),
        organization,
      });
    },
    [value, routes, organization]
  );

  const onReplace = useCallback(() => {
    trackAnalytics('projectselector.direct_selection', {
      path: getRouteStringFromRoutes(routes),
      organization,
    });
  }, [routes, organization]);

  const handleReset = useCallback(() => {
    onReset?.();
    trackAnalytics('projectselector.clear', {
      path: getRouteStringFromRoutes(routes),
      organization,
    });
  }, [onReset, routes, organization]);

  const options = useMemo<SelectOptionOrSection<number>[]>(() => {
    const hasProjects = !!memberProjects.length || !!nonMemberProjects.length;
    if (!hasProjects) {
      return [];
    }

    const getProjectItem = (project: Project) => {
      return {
        value: parseInt(project.id, 10),
        label: project.slug,
        leadingItems: (
          <ProjectBadge project={project} avatarSize={16} hideName disableLink />
        ),
        trailingItems: ({isFocused}: any) => (
          <Fragment>
            <TrailingButton
              borderless
              size="zero"
              icon={<IconOpen />}
              aria-label={t('Project Details')}
              to={`/organizations/${organization.slug}/projects/${project.slug}/?project=${project.id}`}
              visible={isFocused}
            />
            <TrailingButton
              borderless
              size="zero"
              icon={<IconSettings />}
              aria-label={t('Project Settings')}
              to={`/settings/${organization.slug}/projects/${project.slug}/`}
              visible={isFocused}
            />
            <StyledBookmarkStar
              project={project}
              organization={organization}
              visible={isFocused}
              onToggle={(isBookmarked: boolean) => {
                trackAnalytics('projectselector.bookmark_toggle', {
                  bookmarked: isBookmarked,
                  organization,
                });
              }}
            />
          </Fragment>
        ),
      };
    };

    const lastSelected = mapURLValueToNormalValue(pageFilterValue);
    const listSort = (project: Project) => [
      !lastSelected.includes(parseInt(project.id, 10)),
      !project.isBookmarked,
      project.slug,
    ];

    return nonMemberProjects.length > 0
      ? [
          {
            key: 'my-projects',
            label: t('My Projects'),
            options: sortBy(memberProjects, listSort).map(getProjectItem),
            showToggleAllButton: allowMultiple,
          },
          {
            key: 'no-membership-header',
            label:
              memberProjects.length > 0 ? t('Other') : t("Projects I Don't Belong To"),
            options: sortBy(nonMemberProjects, listSort).map(getProjectItem),
          },
        ]
      : sortBy(memberProjects, listSort).map(getProjectItem);
  }, [
    organization,
    allowMultiple,
    memberProjects,
    nonMemberProjects,
    mapURLValueToNormalValue,
    pageFilterValue,
  ]);

  const desynced = desyncedFilters.has('projects');
  const defaultMenuWidth = useMemo(() => {
    const flatOptions: SelectOption<number>[] = options.flatMap(item =>
      'options' in item ? item.options : [item]
    );

    // ProjectPageFilter will try to expand to accommodate the longest project slug
    const longestSlugLength = flatOptions
      .slice(0, 25)
      .reduce(
        (acc, cur) => (String(cur.label).length > acc ? String(cur.label).length : acc),
        0
      );

    // Calculate an appropriate width for the menu. It should be between 22  and 28em.
    // Within that range, the width is a function of the length of the longest slug.
    // The project slugs take up to (longestSlugLength * 0.6)em of horizontal space
    // (each character occupies roughly 0.6em).
    // We also need to add 12em to account for padding, trailing buttons, and the checkbox.
    const minWidthEm = 22;
    return `${Math.max(minWidthEm, Math.min(28, longestSlugLength * 0.6 + 12))}em`;
  }, [options]);

  const [stagedValue, setStagedValue] = useState<number[]>(value);
  const selectionLimitExceeded = useMemo(() => {
    const mappedValue = mapNormalValueToURLValue(stagedValue);
    return mappedValue.length > SELECTION_COUNT_LIMIT;
  }, [stagedValue, mapNormalValueToURLValue]);

  const menuFooterMessage = useMemo(() => {
    if (selectionLimitExceeded) {
      return (hasStagedChanges: any) =>
        hasStagedChanges
          ? tct(
              'Only up to [limit] projects can be selected at a time. You can still press “Clear” to see all projects.',
              {limit: SELECTION_COUNT_LIMIT}
            )
          : footerMessage;
    }

    return footerMessage;
  }, [selectionLimitExceeded, footerMessage]);

  const hasProjectWrite = organization.access.includes('project:write');

  return (
    <HybridFilter
      {...selectProps}
      searchable
      multiple={allowMultiple}
      options={options}
      value={value}
      defaultValue={defaultValue}
      onChange={handleChange}
      onStagedValueChange={setStagedValue}
      onReset={handleReset}
      onReplace={onReplace}
      onToggle={onToggle}
      disabled={disabled ?? (!projectsLoaded || !pageFilterIsReady)}
      disableCommit={selectionLimitExceeded}
      sizeLimit={sizeLimit ?? 25}
      sizeLimitMessage={sizeLimitMessage ?? t('Use search to find more projects…')}
      emptyMessage={emptyMessage ?? t('No projects found')}
      menuTitle={menuTitle ?? t('Filter Projects')}
      menuWidth={menuWidth ?? defaultMenuWidth}
      menuBody={desynced && <DesyncedFilterMessage />}
      menuFooter={
        hasProjectWrite && (
          <ProjectPageFilterMenuFooter
            handleChange={handleChange}
            showNonMemberProjects={showNonMemberProjects}
          />
        )
      }
      menuFooterMessage={menuFooterMessage}
      trigger={
        trigger ??
        ((triggerProps, isOpen) => (
          <ProjectPageFilterTrigger
            {...triggerProps}
            isOpen={isOpen}
            size={selectProps.size}
            value={value}
            memberProjects={memberProjects}
            nonMemberProjects={nonMemberProjects}
            ready={projectsLoaded && pageFilterIsReady}
            desynced={desynced}
            {...triggerProps}
          />
        ))
      }
      checkboxWrapper={checkboxWrapper}
      shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
    />
  );
}

function shouldCloseOnInteractOutside(target: Element) {
  // Don't close select menu when clicking on power hovercard ("Requires Business Plan")
  const powerHovercard = document.querySelector("[data-test-id='power-hovercard']");
  return !powerHovercard || !powerHovercard.contains(target);
}

function checkboxWrapper(
  renderCheckbox: Parameters<NonNullable<HybridFilterProps<number>['checkboxWrapper']>>[0]
) {
  return (
    <Feature
      features="organizations:global-views"
      hookName="feature-disabled:project-selector-checkbox"
      renderDisabled={props => (
        <Hovercard
          body={
            <FeatureDisabled
              features={props.features}
              hideHelpToggle
              featureName={t('Multiple Project Selection')}
            />
          }
        >
          {typeof props.children === 'function' ? props.children(props) : props.children}
        </Hovercard>
      )}
    >
      {({hasFeature}) => renderCheckbox({disabled: !hasFeature})}
    </Feature>
  );
}

const TrailingButton = styled(LinkButton)<{visible: boolean}>`
  color: ${p => p.theme.subText};
  display: ${p => (p.visible ? 'block' : 'none')};
`;

const StyledBookmarkStar = styled(BookmarkStar)<{visible: boolean}>`
  display: ${p => (p.visible ? 'block' : 'none')};
  &[aria-pressed='true'] {
    display: block;
  }
`;
