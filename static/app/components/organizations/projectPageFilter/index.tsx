import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';
import sortBy from 'lodash/sortBy';

import {updateProjects} from 'sentry/actionCreators/pageFilters';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Button} from 'sentry/components/button';
import {SelectOption, SelectOptionOrSection} from 'sentry/components/compactSelect';
import {Hovercard} from 'sentry/components/hovercard';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {
  HybridFilter,
  HybridFilterProps,
} from 'sentry/components/organizations/hybridFilter';
import BookmarkStar from 'sentry/components/projects/bookmarkStar';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconOpen, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {useRoutes} from 'sentry/utils/useRoutes';

import {ProjectPageFilterMenuFooter} from './menuFooter';
import {ProjectPageFilterTrigger} from './trigger';

export interface ProjectPageFilterProps {
  /**
   * Message to show in the menu footer
   */
  footerMessage?: string;
  /**
   * Triggers any time a selection is changed, but the menu has not yet been closed or "applied"
   */
  onChange?: (selected: number[]) => void;
  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
}

export function ProjectPageFilter({
  onChange,
  resetParamsOnChange,
  footerMessage,
  ...selectProps
}: ProjectPageFilterProps) {
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
    const {isSuperuser} = ConfigStore.get('user');
    const isOrgAdminOrManager =
      organization.orgRole === 'owner' || organization.orgRole === 'manager';
    const isOpenMembership = organization.features.includes('open-membership');

    return isSuperuser || isOrgAdminOrManager || isOpenMembership;
  }, [organization.orgRole, organization.features]);

  const nonMemberProjects = useMemo(
    () => (showNonMemberProjects ? otherProjects : []),
    [otherProjects, showNonMemberProjects]
  );

  const {
    selection: {projects: pageFilterValue},
    isReady: pageFilterIsReady,
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
        return memberProjects.map(p => parseInt(p.id, 10));
      }

      return val;
    },
    [memberProjects]
  );

  const [value, setValue] = useState<number[]>(mapURLValueToNormalValue(pageFilterValue));

  const handleChange = useCallback(
    async (newValue: number[]) => {
      onChange?.(newValue);
      setValue(newValue);

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
    newValue => {
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

  const onClear = useCallback(() => {
    trackAnalytics('projectselector.clear', {
      path: getRouteStringFromRoutes(routes),
      organization,
    });
  }, [routes, organization]);

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
        trailingItems: ({isFocused}) => (
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
                  org_id: parseInt(organization.id, 10),
                  bookmarked: isBookmarked,
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
            showToggleAllButton: allowMultiple && memberProjects.length > 0,
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

  const menuWidth = useMemo(() => {
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

    // Calculate an appropriate width for the menu. It should be between 20 and 28em.
    // Within that range, the width is a function of the length of the longest slug. The
    // project slugs take up to (longestSlugLength * 0.6)em of horizontal space (each
    // character occupies roughly 0.6em). We also need to add 12em to account for padding,
    // trailing buttons, and the checkbox.
    return `${Math.max(20, Math.min(28, longestSlugLength * 0.6 + 12))}em`;
  }, [options]);

  return (
    <HybridFilter
      {...selectProps}
      searchable
      multiple={allowMultiple}
      options={options}
      value={value}
      onChange={handleChange}
      onReplace={onReplace}
      onToggle={onToggle}
      onClear={onClear}
      disabled={!projectsLoaded || !pageFilterIsReady}
      sizeLimit={25}
      sizeLimitMessage={t('Use search to find more projects…')}
      emptyMessage={t('No projects found')}
      menuTitle={t('Filter Projects')}
      menuWidth={menuWidth}
      menuFooter={
        <ProjectPageFilterMenuFooter
          handleChange={handleChange}
          showNonMemberProjects={showNonMemberProjects}
        />
      }
      menuFooterMessage={footerMessage}
      trigger={triggerProps => (
        <ProjectPageFilterTrigger
          value={value}
          memberProjects={memberProjects}
          nonMemberProjects={nonMemberProjects}
          ready={projectsLoaded && pageFilterIsReady}
          {...triggerProps}
        />
      )}
      checkboxWrapper={checkboxWrapper}
      shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
    />
  );
}

function shouldCloseOnInteractOutside(target: HTMLElement) {
  // Don't close select menu when clicking on power hovercard ("Requires Business Plan")
  const powerHovercard = document.querySelector("[data-test-id='power-hovercard']");
  return !powerHovercard || !powerHovercard.contains(target);
}

function checkboxWrapper(
  renderCheckbox: Parameters<NonNullable<HybridFilterProps<number>['checkboxWrapper']>>[0]
) {
  return (
    <Feature
      features={['organizations:global-views']}
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

const TrailingButton = styled(Button)<{visible: boolean}>`
  color: ${p => p.theme.subText};
  display: ${p => (p.visible ? 'block' : 'none')};
`;

const StyledBookmarkStar = styled(BookmarkStar)<{visible: boolean}>`
  display: ${p => (p.visible ? 'block' : 'none')};
  &[aria-pressed='true'] {
    display: block;
  }
`;
