import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import HookOrDefault from 'app/components/hookOrDefault';
import Link from 'app/components/links/link';
import HeaderItem from 'app/components/organizations/headerItem';
import PlatformList from 'app/components/platformList';
import Tooltip from 'app/components/tooltip';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {IconProject} from 'app/icons';
import {t, tct} from 'app/locale';
import {growIn} from 'app/styles/animations';
import space from 'app/styles/space';
import {MinimalProject, Organization, Project} from 'app/types';
import {analytics} from 'app/utils/analytics';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';

import ProjectSelector from './projectSelector';

type Props = WithRouterProps & {
  organization: Organization;
  value: number[];
  projects: Project[];
  nonMemberProjects: Project[];
  onChange: (selected: number[]) => unknown;
  onUpdate: () => unknown;
  isGlobalSelectionReady?: boolean;
  disableMultipleProjectSelection?: boolean;
  shouldForceProject?: boolean;
  forceProject?: MinimalProject | null;
  showIssueStreamLink?: boolean;
  showProjectSettingsLink?: boolean;
  lockedMessageSubject?: React.ReactNode;
  footerMessage?: React.ReactNode;
};

type State = {
  hasChanges: boolean;
};

class MultipleProjectSelector extends React.PureComponent<Props, State> {
  static defaultProps = {
    lockedMessageSubject: t('page'),
  };

  state: State = {
    hasChanges: false,
  };

  get multi() {
    const {organization, disableMultipleProjectSelection} = this.props;
    return (
      !disableMultipleProjectSelection && organization.features.includes('global-views')
    );
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
  handleUpdate = (actions: {close: () => void}) => {
    actions.close();
    this.doUpdate();
  };

  /**
   * Handler for when a dropdown item was selected directly (and not via multi select)
   *
   * Should perform an "update" callback
   */
  handleQuickSelect = (selected: Pick<Project, 'id'>) => {
    analytics('projectselector.direct_selection', {
      path: getRouteStringFromRoutes(this.props.router.routes),
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

    const {value} = this.props;
    analytics('projectselector.update', {
      count: value.length,
      path: getRouteStringFromRoutes(this.props.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
      multi: this.multi,
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
      path: getRouteStringFromRoutes(this.props.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
    });

    this.props.onChange([]);

    // Update on clear
    this.doUpdate();
  };

  /**
   * Handler for selecting multiple items, should NOT call update
   */
  handleMultiSelect = (selected: Project[]) => {
    const {onChange, value} = this.props;

    analytics('projectselector.toggle', {
      action: selected.length > value.length ? 'added' : 'removed',
      path: getRouteStringFromRoutes(this.props.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
    });

    const selectedList = selected.map(({id}) => parseInt(id, 10)).filter(i => i);
    onChange(selectedList);
    this.setState({hasChanges: true});
  };

  renderProjectName() {
    const {forceProject, location, organization, showIssueStreamLink} = this.props;

    if (showIssueStreamLink && forceProject && this.multi) {
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
      disableMultipleProjectSelection,
      nonMemberProjects,
      organization,
      shouldForceProject,
      forceProject,
      showProjectSettingsLink,
      footerMessage,
    } = this.props;
    const selectedProjectIds = new Set(value);
    const multi = this.multi;

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
          (forceProject &&
            showProjectSettingsLink &&
            `/settings/${organization.slug}/projects/${forceProject.slug}/`) ||
          undefined
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
            multi={!!multi}
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
                disableMultipleProjectSelection={disableMultipleProjectSelection}
                organization={organization}
                hasChanges={this.state.hasChanges}
                onApply={() => this.handleUpdate(actions)}
                onShowAllProjects={() => {
                  this.handleQuickSelect({id: ALL_ACCESS_PROJECTS.toString()});
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
                  icon={icon}
                  hasSelected={hasSelected}
                  hasChanges={this.state.hasChanges}
                  isOpen={isOpen}
                  onClear={this.handleClear}
                  allowClear={multi}
                  settingsLink={
                    selectedProjects.length === 1
                      ? `/settings/${organization.slug}/projects/${selected[0]?.slug}/`
                      : ''
                  }
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

const MultiProjectOverride = HookOrDefault({
  hookName: 'project-selector-all-projects:customization',
  defaultComponent: ({children, defaultButtonText, defaultOnClick, organization}) => {
    // render nothing if feature unavailable
    if (!organization.features.includes('global-views')) {
      return null;
    }
    return children({buttonText: defaultButtonText, onClick: defaultOnClick});
  },
});

type ControlProps = {
  organization: Organization;
  onApply: () => void;
  onShowAllProjects: () => void;
  onShowMyProjects: () => void;
  selected?: Set<number>;
  disableMultipleProjectSelection?: boolean;
  hasChanges?: boolean;
  message?: React.ReactNode;
};

const SelectorFooterControls = ({
  selected,
  disableMultipleProjectSelection,
  hasChanges,
  onApply,
  onShowAllProjects,
  onShowMyProjects,
  organization,
  message,
}: ControlProps) => {
  // Nothing to show.
  if (disableMultipleProjectSelection && !hasChanges && !message) {
    return null;
  }

  // see we should show "All Projects" or "My Projects" if disableMultipleProjectSelection isn't true
  const hasGlobalRole = organization.role === 'owner' || organization.role === 'manager';
  const hasOpenMembership = organization.features.includes('open-membership');
  const allSelected = selected && selected.has(ALL_ACCESS_PROJECTS);

  const canShowAllProjects = (hasGlobalRole || hasOpenMembership) && !allSelected;
  const onProjectClick = canShowAllProjects ? onShowAllProjects : onShowMyProjects;
  const projectText = canShowAllProjects
    ? t('Select All Projects')
    : t('Select My Projects');

  return (
    <FooterContainer>
      {message && <FooterMessage>{message}</FooterMessage>}

      <FooterActions>
        {!disableMultipleProjectSelection && (
          <MultiProjectOverride
            defaultButtonText={projectText}
            defaultOnClick={onProjectClick}
            canShowAllProjects={canShowAllProjects}
            organization={organization}
          >
            {({buttonText, ...rest}) => (
              <Button priority="default" size="xsmall" {...rest}>
                {buttonText}
              </Button>
            )}
          </MultiProjectOverride>
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

export default withRouter(MultipleProjectSelector);

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
  background-color: ${p => p.theme.background};
  color: ${p => p.theme.textColor};
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
  color: ${p => p.theme.subText};

  &:hover {
    color: ${p => p.theme.subText};
  }
`;
