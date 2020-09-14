import PropTypes from 'prop-types';
import React from 'react';
import sortBy from 'lodash/sortBy';
import styled from '@emotion/styled';
import {Link} from 'react-router';

import {analytics} from 'app/utils/analytics';
import {t} from 'app/locale';
import {alertHighlight, pulse} from 'app/styles/animations';
import Button from 'app/components/button';
import BookmarkStar from 'app/components/projects/bookmarkStar';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import GlobalSelectionHeaderRow from 'app/components/globalSelectionHeaderRow';
import Highlight from 'app/components/highlight';
import Hovercard from 'app/components/hovercard';
import IdBadge from 'app/components/idBadge';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import {IconAdd, IconSettings} from 'app/icons';

const renderDisabledCheckbox = p => (
  <Hovercard
    body={
      <FeatureDisabled
        features={p.features}
        hideHelpToggle
        message={t('Multiple project selection disabled')}
        featureName={t('Multiple Project Selection')}
      />
    }
  >
    {p.children}
  </Hovercard>
);

class ProjectSelector extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,

    // used by multiProjectSelector
    multiProjects: PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.string, SentryTypes.Project])
    ),
    nonMemberProjects: PropTypes.arrayOf(SentryTypes.Project),

    // Render a footer at the bottom of the list
    // render function that is passed an `actions` object with `close` and `open` properties.
    menuFooter: PropTypes.func,

    // Allow selecting multiple projects?
    multi: PropTypes.bool,

    // Use this if the component should be a controlled component
    selectedProjects: PropTypes.arrayOf(SentryTypes.Project),

    // Callback when a project is selected
    onSelect: PropTypes.func,

    // Callback when the menu is closed
    onClose: PropTypes.func,

    // Callback when the input filter changes
    onFilterChange: PropTypes.func,

    // Callback when the list is scrolled
    onScroll: PropTypes.func,

    // Callback when projects are selected via the multiple project selector
    // Calls back with (projects[], event)
    onMultiSelect: PropTypes.func,
    rootClassName: PropTypes.string,

    // Represents if a search is taking place
    searching: PropTypes.bool,

    // Represents if the current project selector is paginated or fully loaded.
    // Currently only used to ensure that in an empty state the input is not
    // hidden. This is for the case in which a user searches for a project which
    // does not exist. If we hide the input due to no results, the user cannot
    // recover.
    paginated: PropTypes.bool,
  };

  static defaultProps = {
    projectId: null,
    multi: false,
    onSelect: () => {},
  };

  state = {
    selectedProjects: new Map(),
  };

  urlPrefix() {
    return `/organizations/${this.props.organization.slug}`;
  }

  getProjects() {
    const {multiProjects, nonMemberProjects, selectedProjects} = this.props;

    return [
      sortBy(multiProjects, project => [
        !(selectedProjects || []).includes(project),
        !project.isBookmarked,
        project.slug,
      ]),
      sortBy(nonMemberProjects || [], project => [project.slug]),
    ];
  }

  handleSelect = ({value: project}) => {
    const {onSelect} = this.props;

    onSelect(project);
  };

  handleMultiSelect = (project, e) => {
    const {onMultiSelect, selectedProjects} = this.props;
    const hasCallback = typeof onMultiSelect === 'function';

    if (!hasCallback) {
      // eslint-disable-next-line no-console
      console.error(
        'ProjectSelector is a controlled component but `onMultiSelect` callback is not defined'
      );
      return;
    }

    const selectedProjectsMap = new Map(selectedProjects.map(p => [p.slug, p]));
    if (selectedProjectsMap.has(project.slug)) {
      // unselected a project

      selectedProjectsMap.delete(project.slug);
    } else {
      selectedProjectsMap.set(project.slug, project);
    }

    onMultiSelect(Array.from(selectedProjectsMap.values()), e);
  };

  render() {
    const {
      children,
      organization: org,
      menuFooter,
      multi,
      className,
      rootClassName,
      onClose,
      onFilterChange,
      onScroll,
      searching,
      paginated,
    } = this.props;
    const access = new Set(org.access);

    const [projects, nonMemberProjects] = this.getProjects();

    const hasProjects =
      (projects && !!projects.length) ||
      (nonMemberProjects && !!nonMemberProjects.length);
    const hasProjectWrite = access.has('project:write');

    const getProjectItem = project => ({
      value: project,
      searchKey: project.slug,
      label: ({inputValue}) => (
        <ProjectSelectorItem
          project={project}
          organization={org}
          multi={multi}
          inputValue={inputValue}
          isChecked={
            !!this.props.selectedProjects.find(({slug}) => slug === project.slug)
          }
          style={{padding: 0}}
          onMultiSelect={this.handleMultiSelect}
        />
      ),
    });

    const projectList = hasProjects
      ? [
          {
            hideGroupLabel: true,
            items: projects.map(getProjectItem),
          },
          {
            hideGroupLabel: nonMemberProjects.length === 0,
            itemSize: 'small',
            id: 'no-membership-header', // needed for tests for non-virtualized lists
            label: <Label>{t("Projects I don't belong to")}</Label>,
            items: nonMemberProjects.map(getProjectItem),
          },
        ]
      : [];
    return (
      <DropdownAutoComplete
        alignMenu="left"
        allowActorToggle
        closeOnSelect
        blendCorner={false}
        searchPlaceholder={t('Filter projects')}
        onSelect={this.handleSelect}
        onClose={onClose}
        onChange={onFilterChange}
        busyItemsStillVisible={searching}
        onScroll={onScroll}
        maxHeight={500}
        zIndex={theme.zIndex.dropdown}
        css={{marginTop: 6}}
        inputProps={{style: {padding: 8, paddingLeft: 10}}}
        rootClassName={rootClassName}
        className={className}
        emptyMessage={t('You have no projects')}
        noResultsMessage={t('No projects found')}
        virtualizedHeight={theme.headerSelectorRowHeight}
        virtualizedLabelHeight={theme.headerSelectorLabelHeight}
        emptyHidesInput={!paginated}
        inputActions={() => (
          <AddButton
            disabled={!hasProjectWrite}
            to={`/organizations/${org.slug}/projects/new/`}
            size="xsmall"
            icon={<IconAdd size="xs" isCircled />}
            title={
              hasProjectWrite ? null : t("You don't have permission to add a project")
            }
          >
            {t('Project')}
          </AddButton>
        )}
        menuFooter={renderProps => {
          const renderedFooter =
            typeof menuFooter === 'function' ? menuFooter(renderProps) : menuFooter;
          const showCreateProjectButton = !hasProjects && hasProjectWrite;

          if (!renderedFooter && !showCreateProjectButton) {
            return null;
          }

          return (
            <React.Fragment>
              {showCreateProjectButton && (
                <CreateProjectButton
                  priority="primary"
                  size="small"
                  to={`${this.urlPrefix()}/projects/new/`}
                >
                  {t('Create project')}
                </CreateProjectButton>
              )}
              {renderedFooter}
            </React.Fragment>
          );
        }}
        items={projectList}
      >
        {renderProps =>
          children({
            ...renderProps,
            selectedProjects: this.props.selectedProjects,
          })
        }
      </DropdownAutoComplete>
    );
  }
}

class ProjectSelectorItem extends React.PureComponent {
  static propTypes = {
    project: SentryTypes.Project.isRequired,
    organization: SentryTypes.Organization.isRequired,
    multi: PropTypes.bool,
    inputValue: PropTypes.string,
    isChecked: PropTypes.bool,
    onMultiSelect: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      bookmarkHasChanged: false,
    };
  }

  componentDidUpdate(nextProps) {
    if (nextProps.project.isBookmarked !== this.props.project.isBookmarked) {
      this.setBookmarkHasChanged();
    }
  }

  setBookmarkHasChanged() {
    this.setState({
      bookmarkHasChanged: true,
    });
  }

  handleMultiSelect = e => {
    const {project, onMultiSelect} = this.props;
    onMultiSelect(project, e);
  };

  handleClick = e => {
    e.stopPropagation();
    this.handleMultiSelect(e);
  };

  handleBookmarkToggle = isBookmarked => {
    analytics('projectselector.bookmark_toggle', {
      org_id: parseInt(this.props.organization.id, 10),
      bookmarked: isBookmarked,
    });
  };

  clearAnimation = () => {
    this.setState({bookmarkHasChanged: false});
  };

  render() {
    const {project, multi, inputValue, isChecked, organization} = this.props;

    return (
      <BadgeAndActionsWrapper
        bookmarkHasChanged={this.state.bookmarkHasChanged}
        onAnimationEnd={this.clearAnimation}
      >
        <GlobalSelectionHeaderRow
          checked={isChecked}
          onCheckClick={this.handleClick}
          multi={multi}
          priority="secondary"
          renderCheckbox={({checkbox}) => (
            <Feature
              features={['organizations:global-views']}
              hookName="feature-disabled:project-selector-checkbox"
              renderDisabled={renderDisabledCheckbox}
            >
              {checkbox}
            </Feature>
          )}
        >
          <BadgeWrapper multi={multi}>
            <IdBadge
              project={project}
              avatarSize={16}
              displayName={<Highlight text={inputValue}>{project.slug}</Highlight>}
              avatarProps={{consistentWidth: true}}
            />
          </BadgeWrapper>
          <StyledBookmarkStar
            project={project}
            organization={organization}
            bookmarkHasChanged={this.state.bookmarkHasChanged}
            onToggle={this.handleBookmarkToggle}
          />
          <SettingsIconLink
            to={`/settings/${organization.slug}/${project.slug}/`}
            onClick={e => e.stopPropagation()}
          >
            <IconSettings />
          </SettingsIconLink>
        </GlobalSelectionHeaderRow>
      </BadgeAndActionsWrapper>
    );
  }
}

const StyledBookmarkStar = styled(BookmarkStar)`
  padding: ${space(1)} ${space(0.5)};
  box-sizing: content-box;
  opacity: ${p => (p.project.isBookmarked ? 1 : 0.33)};
  transition: 0.5s opacity ease-out;
  display: block;
  width: 14px;
  height: 14px;
  margin-top: -${space(0.25)}; /* trivial alignment bump */
  animation: ${p => (p.bookmarkHasChanged ? `0.5s ${pulse(1.4)}` : 'none')};
`;

const CreateProjectButton = styled(Button)`
  display: block;
  text-align: center;
  margin: ${space(0.5)} 0;
`;

const AddButton = styled(Button)`
  display: block;
  margin: 0 ${space(1)};
  color: ${p => p.theme.gray500};

  &:hover {
    color: ${p => p.theme.gray600};
  }
`;

const BadgeWrapper = styled('div')`
  display: flex;
  flex: 1;
  ${p => !p.multi && 'flex: 1'};
  white-space: nowrap;
  overflow: hidden;
`;

const SettingsIconLink = styled(Link)`
  color: ${p => p.theme.gray500};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1)} ${space(0.25)} ${space(1)} ${space(1)};
  opacity: 0.33;
  transition: 0.5s opacity ease-out;

  &:hover {
    color: ${p => p.theme.gray700};
  }
`;

const Label = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray500};
`;

const BadgeAndActionsWrapper = styled('div')`
  animation: ${p => (p.bookmarkHasChanged ? `1s ${alertHighlight('info')}` : 'none')};
  z-index: ${p => (p.bookmarkHasChanged ? 1 : 'inherit')};
  position: relative;
  border-style: solid;
  border-width: 1px 0;
  border-color: transparent;
  &:hover
    ${/* sc-selector */ StyledBookmarkStar},
    &:hover
    ${/* sc-selector */ SettingsIconLink} {
    opacity: 1;
  }
`;

export default ProjectSelector;
