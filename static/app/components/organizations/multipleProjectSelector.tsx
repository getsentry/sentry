import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import Button from 'sentry/components/button';
import {GetActorPropsFn} from 'sentry/components/dropdownMenu';
import Link from 'sentry/components/links/link';
import HeaderItem from 'sentry/components/organizations/headerItem';
import PlatformList from 'sentry/components/platformList';
import Tooltip from 'sentry/components/tooltip';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconProject} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {growIn} from 'sentry/styles/animations';
import space from 'sentry/styles/space';
import {MinimalProject, Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';

import ProjectSelector from './projectSelector';

type Props = WithRouterProps & {
  memberProjects: Project[];
  nonMemberProjects: Project[];
  onChange: (selected: number[]) => void;
  onUpdate: (newProjects?: number[]) => void;
  organization: Organization;
  value: number[];
  customDropdownButton?: (config: {
    getActorProps: GetActorPropsFn;
    isOpen: boolean;
    selectedProjects: Project[];
  }) => React.ReactElement;
  customLoadingIndicator?: React.ReactNode;
  detached?: boolean;
  disableMultipleProjectSelection?: boolean;
  footerMessage?: React.ReactNode;
  forceProject?: MinimalProject | null;
  isGlobalSelectionReady?: boolean;
  lockedMessageSubject?: React.ReactNode;
  shouldForceProject?: boolean;
  showIssueStreamLink?: boolean;
  showProjectSettingsLink?: boolean;
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

  /**
   * Reset "hasChanges" state and call `onUpdate` callback
   * @param value optional parameter that will be passed to onUpdate callback
   */
  doUpdate = (value?: number[]) => {
    this.setState({hasChanges: false}, () => this.props.onUpdate(value));
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
    trackAdvancedAnalyticsEvent('projectselector.direct_selection', {
      path: getRouteStringFromRoutes(this.props.router.routes),
      organization: this.props.organization,
    });
    const value = selected.id === null ? [] : [parseInt(selected.id, 10)];
    this.props.onChange(value);
    this.doUpdate(value);
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

    trackAdvancedAnalyticsEvent('projectselector.update', {
      count: value.length,
      path: getRouteStringFromRoutes(this.props.router.routes),
      organization: this.props.organization,
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
    trackAdvancedAnalyticsEvent('projectselector.clear', {
      path: getRouteStringFromRoutes(this.props.router.routes),
      organization: this.props.organization,
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

    trackAdvancedAnalyticsEvent('projectselector.toggle', {
      action: selected.length > value.length ? 'added' : 'removed',
      path: getRouteStringFromRoutes(this.props.router.routes),
      organization: this.props.organization,
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
      memberProjects,
      isGlobalSelectionReady,
      disableMultipleProjectSelection,
      nonMemberProjects,
      organization,
      shouldForceProject,
      forceProject,
      showProjectSettingsLink,
      footerMessage,
      customDropdownButton,
      customLoadingIndicator,
    } = this.props;
    const selectedProjectIds = new Set(value);
    const multi = this.multi;

    const allProjects = [...memberProjects, ...nonMemberProjects];
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
      customLoadingIndicator ?? (
        <StyledHeaderItem
          data-test-id="global-header-project-selector-loading"
          icon={<IconProject />}
          loading
        >
          {t('Loading\u2026')}
        </StyledHeaderItem>
      )
    ) : (
      <ClassNames>
        {({css}) => (
          <StyledProjectSelector
            {...this.props}
            multi={!!multi}
            selectedProjects={selected}
            multiProjects={memberProjects}
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
                  trackAdvancedAnalyticsEvent('projectselector.multi_button_clicked', {
                    button_type: 'all',
                    path: getRouteStringFromRoutes(this.props.router.routes),
                    organization,
                  });
                }}
                onShowMyProjects={() => {
                  this.handleClear();
                  actions.close();
                  trackAdvancedAnalyticsEvent('projectselector.multi_button_clicked', {
                    button_type: 'my',
                    path: getRouteStringFromRoutes(this.props.router.routes),
                    organization,
                  });
                }}
                message={footerMessage}
              />
            )}
          >
            {({getActorProps, selectedProjects, isOpen}) => {
              if (customDropdownButton) {
                return customDropdownButton({getActorProps, selectedProjects, isOpen});
              }
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

type FeatureRenderProps = {
  hasFeature: boolean;
  renderShowAllButton?: (p: {
    canShowAllProjects: boolean;
    onButtonClick: () => void;
  }) => React.ReactNode;
};

type ControlProps = {
  onApply: () => void;
  onShowAllProjects: () => void;
  onShowMyProjects: () => void;
  organization: Organization;
  disableMultipleProjectSelection?: boolean;
  hasChanges?: boolean;
  message?: React.ReactNode;
  selected?: Set<number>;
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

  // see if we should show "All Projects" or "My Projects" if disableMultipleProjectSelection isn't true
  const hasGlobalRole = organization.role === 'owner' || organization.role === 'manager';
  const hasOpenMembership = organization.features.includes('open-membership');
  const allSelected = selected && selected.has(ALL_ACCESS_PROJECTS);

  const canShowAllProjects = (hasGlobalRole || hasOpenMembership) && !allSelected;
  const onProjectClick = canShowAllProjects ? onShowAllProjects : onShowMyProjects;
  const buttonText = canShowAllProjects
    ? t('Select All Projects')
    : t('Select My Projects');

  return (
    <FooterContainer hasMessage={!!message}>
      {message && <FooterMessage>{message}</FooterMessage>}
      <FooterActions>
        {!disableMultipleProjectSelection && (
          <Feature
            features={['organizations:global-views']}
            organization={organization}
            hookName="feature-disabled:project-selector-all-projects"
            renderDisabled={false}
          >
            {({renderShowAllButton, hasFeature}: FeatureRenderProps) => {
              // if our hook is adding renderShowAllButton, render that
              if (renderShowAllButton) {
                return renderShowAllButton({
                  onButtonClick: onProjectClick,
                  canShowAllProjects,
                });
              }
              // if no hook, render null if feature is disabled
              if (!hasFeature) {
                return null;
              }
              // otherwise render the buton
              return (
                <Button priority="default" size="xsmall" onClick={onProjectClick}>
                  {buttonText}
                </Button>
              );
            }}
          </Feature>
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

const FooterContainer = styled('div')<{hasMessage: boolean}>`
  display: flex;
  justify-content: ${p => (p.hasMessage ? 'space-between' : 'flex-end')};
`;

const FooterActions = styled('div')`
  padding: ${space(1)} 0;
  display: flex;
  justify-content: flex-end;
  & > * {
    margin-left: ${space(0.5)};
  }
  &:empty {
    display: none;
  }
`;
const SubmitButton = styled(Button)`
  animation: 0.1s ${growIn} ease-in;
`;

const FooterMessage = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  padding: ${space(1)} ${space(0.5)};
`;

const StyledProjectSelector = styled(ProjectSelector)`
  background-color: ${p => p.theme.background};
  color: ${p => p.theme.textColor};

  ${p =>
    !p.detached &&
    `
    width: 100%;
    margin: 1px 0 0 -1px;
    border-radius: ${p.theme.borderRadiusBottom};
  `}
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
