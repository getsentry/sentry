import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import {t} from 'app/locale';
import ProjectSelector from 'app/components/projectSelector';
import InlineSvg from 'app/components/inlineSvg';

import HeaderItem from './headerItem';

export default class MultipleProjectSelector extends React.Component {
  static propTypes = {
    anchorRight: PropTypes.bool,
    value: PropTypes.array,
    projects: PropTypes.array,
    onChange: PropTypes.func,
    onUpdate: PropTypes.func,
  };

  static defaultProps = {
    anchorRight: true,
  };

  constructor() {
    super();
    this.state = {
      hasChanges: false,
    };
  }

  handleUpdate = actions => {
    this.props.onUpdate();
    actions.close();
    this.setState({hasChanges: false});
  };

  handleQuickSelect = (selected, checked, e) => {
    const {onUpdate, onChange} = this.props;
    onChange([parseInt(selected.id, 10)]);
    onUpdate();
  };

  handleClear = () => {
    this.props.onChange.bind(this, []).call();
    this.setState({hasChanges: false});
  };

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
        showUpdate
        selectedProjects={selected}
        projects={projects}
        onSelect={this.handleQuickSelect}
        onMultiSelect={this.handleMultiSelect}
        rootClassName={css`
          display: flex;
        `}
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
            : t('Projects and Teams');
          return (
            <StyledHeaderItem
              active={hasSelected || isOpen}
              icon={<StyledInlineSvg src="icon-stack" />}
              hasSelected={hasSelected}
              hasChanges={this.state.hasChanges}
              isOpen={isOpen}
              handleSubmit={this.handleUpdate.bind(this, actions)}
              handleClear={this.handleClear}
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
  z-index: -1;
`;

const StyledHeaderItem = styled(HeaderItem)`
  height: 100%;
  width: 300px;
`;

const StyledInlineSvg = styled(InlineSvg)`
  height: 18px;
  width: 18px;
`;
