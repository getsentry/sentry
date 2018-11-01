import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import {t} from 'app/locale';
import ProjectSelector from 'app/components/projectSelector';
import InlineSvg from 'app/components/inlineSvg';

import HeaderItem from 'app/components/organizations/headerItem';

const rootContainerStyles = css`
  display: flex;
`;

export default class MultipleProjectSelector extends React.Component {
  static propTypes = {
    value: PropTypes.array,
    projects: PropTypes.array,
    onChange: PropTypes.func,
    onUpdate: PropTypes.func,
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
    if (!this.state.hasChanges) return;
    this.doUpdate();
  };

  /**
   * Handler for clearing the current value
   *
   * Should perform an "update" callback
   */
  handleClear = () => {
    this.props.onChange([]);

    // Update on clear
    this.doUpdate();
  };

  /**
   * Handler for selecting multiple items, should NOT call update
   */
  handleMultiSelect = (selected, checked, e) => {
    const {onChange} = this.props;
    onChange(selected.map(({id}) => parseInt(id, 10)));
    this.setState({hasChanges: true});
  };

  render() {
    const {value, projects} = this.props;
    const selectedProjectIds = new Set(value);

    const selected = projects.filter(project =>
      selectedProjectIds.has(parseInt(project.id, 10))
    );

    return (
      <StyledProjectSelector
        {...this.props}
        multi
        selectedProjects={selected}
        projects={projects}
        onSelect={this.handleQuickSelect}
        onClose={this.handleClose}
        onMultiSelect={this.handleMultiSelect}
        rootClassName={rootContainerStyles}
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
              icon={<StyledInlineSvg src="icon-stack" />}
              hasSelected={hasSelected}
              hasChanges={this.state.hasChanges}
              isOpen={isOpen}
              onSubmit={this.handleUpdate.bind(this, actions)}
              onClear={this.handleClear}
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
  width: 300px;
`;

const StyledInlineSvg = styled(InlineSvg)`
  height: 18px;
  width: 18px;
`;
