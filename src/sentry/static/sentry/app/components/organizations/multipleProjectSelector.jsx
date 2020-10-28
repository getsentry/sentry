import {ClassNames} from '@emotion/core';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import {Link} from 'react-router';

import SentryTypes from 'app/sentryTypes';
import {analytics} from 'app/utils/analytics';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import {t, tct} from 'app/locale';
import Button from 'app/components/button';
import Tooltip from 'app/components/tooltip';
import HeaderItem from 'app/components/organizations/headerItem';
import {growIn} from 'app/styles/animations';
import space from 'app/styles/space';
import PlatformList from 'app/components/platformList';
import {IconProject} from 'app/icons';

import ProjectSelector from './projectSelector';

export default class MultipleProjectSelector extends React.PureComponent {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    value: PropTypes.array,
    projects: PropTypes.array.isRequired,
    nonMemberProjects: PropTypes.array.isRequired,
    isGlobalSelectionReady: PropTypes.bool,
    onChange: PropTypes.func,
    onUpdate: PropTypes.func,
    multi: PropTypes.bool,
    shouldForceProject: PropTypes.bool,
    forceProject: SentryTypes.Project,
    showIssueStreamLink: PropTypes.bool,
    showProjectSettingsLink: PropTypes.bool,
    lockedMessageSubject: PropTypes.string,
    footerMessage: PropTypes.node,
  };

  static contextTypes = {
    router: PropTypes.object,
  };

  static defaultProps = {
    multi: true,
    lockedMessageSubject: t('page'),
  };

  state = {
    hasChanges: false,
  };

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

  renderProjectName() {
    const {location} = this.context.router;
    const {forceProject, multi, organization, showIssueStreamLink} = this.props;

    if (showIssueStreamLink && forceProject && multi) {
      return (
        <Tooltip title={t('Issues Stream')} position="bottom">
          <StyledLink
            to={{
              pathname: `/organizations/${organization.slug}/issues/`,
              query: {...location.query, project: forceProject.id},
            }}
          >
            {forceProject.slug}
          </StyledLink>
        </Tooltip>
      );
    }

    if (forceProject) {
      return forceProject.slug;
    }

    return '';
  }

  getLockedMessage() {
    const {forceProject, lockedMessageSubject} = this.props;

    if (forceProject) {
      return tct('This [subject] is unique to the [projectSlug] project', {
        subject: lockedMessageSubject,
        projectSlug: forceProject.slug,
      });
    }

    return tct('This [subject] is unique to a project', {subject: lockedMessageSubject});
  }

  render() {
    const {
      value,
      projects,
      isGlobalSelectionReady,
      nonMemberProjects,
      multi,
      organization,
      shouldForceProject,
      forceProject,
      showProjectSettingsLink,
      footerMessage,
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
        icon={
          forceProject && (
            <PlatformList
              platforms={forceProject.platform ? [forceProject.platform] : []}
              max={1}
            />
          )
        }
        locked
        lockedMessage={this.getLockedMessage()}
        settingsLink={
          forceProject &&
          showProjectSettingsLink &&
          `/settings/${organization.slug}/projects/${forceProject.slug}/`
        }
      >
        {this.renderProjectName()}
      </StyledHeaderItem>
    ) : !isGlobalSelectionReady ? (
      <StyledHeaderItem
        data-test-id="global-header-project-selector-loading"
        icon={<IconProject />}
        loading
      >
        {t('Loading\u2026')}
      </StyledHeaderItem>
    ) : (
      <ClassNames>
        {({css}) => (
          <StyledProjectSelector
            {...this.props}
            multi={multi}
            selectedProjects={selected}
            multiProjects={projects}
            onSelect={this.handleQuickSelect}
            onClose={this.handleClose}
            onMultiSelect={this.handleMultiSelect}
            rootClassName={css`
              display: flex;
            `}
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
                message={footerMessage}
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
              const icon = hasSelected ? (
                <PlatformList
                  platforms={selectedProjects.map(p => p.platform ?? 'other').reverse()}
                  max={5}
                />
              ) : (
                <IconProject />
              );

              return (
                <StyledHeaderItem
                  data-test-id="global-header-project-selector"
                  active={hasSelected || isOpen}
                  icon={icon}
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
        )}
      </ClassNames>
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
    message,
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
  if (!(showAllProjects || showMyProjects || hasChanges || message)) {
    return null;
  }

  return (
    <FooterContainer>
      {message && <FooterMessage>{message}</FooterMessage>}

      <FooterActions>
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
      </FooterActions>
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
  message: PropTypes.node,
};

const FooterContainer = styled('div')`
  padding: ${space(1)} 0;
`;
const FooterActions = styled('div')`
  display: flex;
  justify-content: flex-end;
  & > * {
    margin-left: ${space(0.5)};
  }
`;
const SubmitButton = styled(Button)`
  animation: 0.1s ${growIn} ease-in;
`;

const FooterMessage = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  padding: 0 ${space(0.5)};
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

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray500};

  &:hover {
    color: ${p => p.theme.gray500};
  }
`;
