import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import SentryTypes from 'app/sentryTypes';
import {analytics} from 'app/utils/analytics';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import {t} from 'app/locale';
import Button from 'app/components/button';
import ProjectSelector from 'app/components/projectSelector';
import InlineSvg from 'app/components/inlineSvg';

import HeaderItem from 'app/components/organizations/headerItem';
import {growIn} from 'app/styles/animations';
import space from 'app/styles/space';

const rootContainerStyles = css`
  display: flex;
`;

export default class MultipleProjectSelector extends React.PureComponent {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    value: PropTypes.array,
    projects: PropTypes.array.isRequired,
    nonMemberProjects: PropTypes.array.isRequired,
    onChange: PropTypes.func,
    onUpdate: PropTypes.func,
    multi: PropTypes.bool,
    shouldForceProject: PropTypes.bool,
    forceProject: SentryTypes.Project,
  };

  static contextTypes = {
    router: PropTypes.object,
  };

  static defaultProps = {
    multi: true,
  };

  constructor() {
    super();
    this.state = {
      hasChanges: false,
    };
  }

  // Reset "hasChanges" state and call `onUpdate` callback
  doUpdate = () => {
    this.setState({hasChanges: false}, this.props.onUpdate);
  };

  /**
   * Handler for when an explicit update call should be made.
   * e.g. an "Update" button
   *
   * Should perform an "update" callback
   */
  handleUpdate = actions => {
    actions.close();
    this.doUpdate();
  };

  /**
   * Handler for when a dropdown item was selected directly (and not via multi select)
   *
   * Should perform an "update" callback
   */
  handleQuickSelect = selected => {
    analytics('projectselector.direct_selection', {
      path: getRouteStringFromRoutes(this.context.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
    });

    const value = selected.id === null ? [] : [parseInt(selected.id, 10)];
    this.props.onChange(value);
    this.doUpdate();
  };

  /**
   * Handler for when dropdown menu closes
   *
   * Should perform an "update" callback
   */
  handleClose = () => {
    // Only update if there are changes
    if (!this.state.hasChanges) {
      return;
    }

    const {value, multi} = this.props;
    analytics('projectselector.update', {
      count: value.length,
      path: getRouteStringFromRoutes(this.context.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
      multi,
    });

    this.doUpdate();
  };

  /**
   * Handler for clearing the current value
   *
   * Should perform an "update" callback
   */
  handleClear = () => {
    analytics('projectselector.clear', {
      path: getRouteStringFromRoutes(this.context.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
    });

    this.props.onChange([]);

    // Update on clear
    this.doUpdate();
  };

  /**
   * Handler for selecting multiple items, should NOT call update
   */
  handleMultiSelect = selected => {
    const {onChange, value} = this.props;

    analytics('projectselector.toggle', {
      action: selected.length > value.length ? 'added' : 'removed',
      path: getRouteStringFromRoutes(this.context.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
    });

    selected = selected.map(({id}) => parseInt(id, 10)).filter(i => i);
    onChange(selected);
    this.setState({hasChanges: true});
  };

  render() {
    const {
      value,
      projects,
      nonMemberProjects,
      multi,
      organization,
      shouldForceProject,
      forceProject,
    } = this.props;
    const selectedProjectIds = new Set(value);

    const allProjects = [...projects, ...nonMemberProjects];
    const selected = allProjects.filter(project =>
      selectedProjectIds.has(parseInt(project.id, 10))
    );

    // `forceProject` can be undefined if it is loading the project
    // We are intentionally using an empty string as its "loading" state

    return shouldForceProject ? (
      <StyledHeaderItem
        data-test-id="global-header-project-selector"
        icon={<StyledInlineSvg src="icon-project" />}
        locked
        lockedMessage={
          forceProject
            ? t(`This issue is unique to the ${forceProject.slug} project`)
            : t('This issue is unique to a project')
        }
        settingsLink={
          forceProject && `/settings/${organization.slug}/projects/${forceProject.slug}/`
        }
      >
        {forceProject ? forceProject.slug : ''}
      </StyledHeaderItem>
    ) : (
      <StyledProjectSelector
        {...this.props}
        multi={multi}
        selectedProjects={selected}
        multiProjects={projects}
        onSelect={this.handleQuickSelect}
        onClose={this.handleClose}
        onMultiSelect={this.handleMultiSelect}
        rootClassName={rootContainerStyles}
        menuFooter={({actions}) => (
          <SelectorFooterControls
            selected={selectedProjectIds}
            multi={multi}
            organization={organization}
            hasChanges={this.state.hasChanges}
            onApply={() => this.handleUpdate(actions)}
            onShowAllProjects={() => {
              this.handleQuickSelect({id: ALL_ACCESS_PROJECTS});
              actions.close();
            }}
            onShowMyProjects={() => {
              this.handleClear();
              actions.close();
            }}
          />
        )}
      >
        {({getActorProps, selectedProjects, isOpen}) => {
          const hasSelected = !!selectedProjects.length;
          const title = hasSelected
            ? selectedProjects.map(({slug}) => slug).join(', ')
            : selectedProjectIds.has(ALL_ACCESS_PROJECTS)
            ? t('All Projects')
            : t('My Projects');

          return (
            <StyledHeaderItem
              data-test-id="global-header-project-selector"
              active={hasSelected || isOpen}
              icon={<StyledInlineSvg src="icon-project" />}
              hasSelected={hasSelected}
              hasChanges={this.state.hasChanges}
              isOpen={isOpen}
              onClear={this.handleClear}
              allowClear={multi}
              {...getActorProps()}
            >
              {title}
            </StyledHeaderItem>
          );
        }}
      </StyledProjectSelector>
    );
  }
}

const SelectorFooterControls = props => {
  const {
    selected,
    multi,
    hasChanges,
    onApply,
    onShowAllProjects,
    onShowMyProjects,
    organization,
  } = props;
  let showMyProjects = false;
  let showAllProjects = false;
  if (multi) {
    showMyProjects = true;

    const hasGlobalRole = ['owner', 'manager'].includes(organization.role);
    const hasOpenMembership = organization.features.includes('open-membership');
    const allSelected = selected && selected.has(ALL_ACCESS_PROJECTS);
    if ((hasGlobalRole || hasOpenMembership) && !allSelected) {
      showAllProjects = true;
      showMyProjects = false;
    }
  }

  // Nothing to show.
  if (!(showAllProjects || showMyProjects || hasChanges)) {
    return null;
  }

  return (
    <FooterContainer>
      {showAllProjects && (
        <Button onClick={onShowAllProjects} priority="default" size="xsmall">
          {t('View All Projects')}
        </Button>
      )}
      {showMyProjects && (
        <Button onClick={onShowMyProjects} priority="default" size="xsmall">
          {t('View My Projects')}
        </Button>
      )}
      {hasChanges && (
        <SubmitButton onClick={onApply} size="xsmall" priority="primary">
          {t('Apply Filter')}
        </SubmitButton>
      )}
    </FooterContainer>
  );
};
SelectorFooterControls.propTypes = {
  // Actually a set
  selected: PropTypes.instanceOf(Set),
  organization: SentryTypes.Organization,
  multi: PropTypes.bool,
  hasChanges: PropTypes.bool,
  onApply: PropTypes.func,
  onShowAllProjects: PropTypes.func,
  onShowMyProjects: PropTypes.func,
};

const FooterContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  padding: ${space(1)} 0;
  & > * {
    margin-left: ${space(0.5)};
  }
`;
const SubmitButton = styled(Button)`
  animation: 0.1s ${growIn} ease-in;
`;

const StyledProjectSelector = styled(ProjectSelector)`
  margin: 1px 0 0 -1px;
  border-radius: ${p => p.theme.borderRadiusBottom};
  width: 100%;
`;

const StyledHeaderItem = styled(HeaderItem)`
  height: 100%;
  width: 100%;
  ${p => p.locked && 'cursor: default'};
`;

const StyledInlineSvg = styled(InlineSvg)`
  height: 18px;
  width: 18px;
  transform: translateY(-2px);
`;
