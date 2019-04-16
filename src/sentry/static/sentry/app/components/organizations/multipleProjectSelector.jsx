import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import SentryTypes from 'app/sentryTypes';
import {analytics} from 'app/utils/analytics';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import {t} from 'app/locale';
import ProjectSelector from 'app/components/projectSelector';
import InlineSvg from 'app/components/inlineSvg';

import HeaderItem from 'app/components/organizations/headerItem';
import MultipleSelectorSubmitRow from 'app/components/organizations/multipleSelectorSubmitRow';

const rootContainerStyles = css`
  display: flex;
`;

export default class MultipleProjectSelector extends React.PureComponent {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    value: PropTypes.array,
    projects: PropTypes.array.isRequired,
    onChange: PropTypes.func,
    onUpdate: PropTypes.func,
    multi: PropTypes.bool,
    forceProject: SentryTypes.Project,
  };

  static defaultProps = {
    multi: true,
  };

  static contextTypes = {
    router: PropTypes.object,
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
  handleQuickSelect = (selected, checked, e) => {
    analytics('projectselector.direct_selection', {
      path: getRouteStringFromRoutes(this.context.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
    });

    this.props.onChange([parseInt(selected.id, 10)]);
    this.doUpdate();
  };

  /**
   * Handler for when dropdown menu closes
   *
   * Should perform an "update" callback
   */
  handleClose = props => {
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
  handleMultiSelect = (selected, checked, e) => {
    const {onChange, value} = this.props;

    analytics('projectselector.toggle', {
      action: selected.length > value.length ? 'added' : 'removed',
      path: getRouteStringFromRoutes(this.context.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
    });
    onChange(selected.map(({id}) => parseInt(id, 10)));
    this.setState({hasChanges: true});
  };

  render() {
    const {value, projects, multi, organization, forceProject} = this.props;
    const selectedProjectIds = new Set(value);

    const selected = projects.filter(project =>
      selectedProjectIds.has(parseInt(project.id, 10))
    );

    return forceProject ? (
      <StyledHeaderItem
        icon={<StyledInlineSvg src="icon-project" />}
        locked={true}
        lockedMessage={t(`This issue is unique to the ${forceProject.slug} project`)}
        settingsLink={`/settings/${organization.slug}/projects/${forceProject.slug}/`}
      >
        {forceProject.slug}
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
        menuFooter={({actions}) =>
          this.state.hasChanges && (
            <MultipleSelectorSubmitRow onSubmit={() => this.handleUpdate(actions)} />
          )
        }
      >
        {({
          getActorProps,
          selectedItem,
          activeProject,
          selectedProjects,
          isOpen,
          actions,
          onBlur,
        }) => {
          const hasSelected = !!selectedProjects.length;
          const title = hasSelected
            ? selectedProjects.map(({slug}) => slug).join(', ')
            : t('All Projects');
          return (
            <StyledHeaderItem
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

const StyledProjectSelector = styled(ProjectSelector)`
  margin: 1px 0 0 -1px;
  border-radius: 0 0 4px 4px;
  width: 110%;
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
