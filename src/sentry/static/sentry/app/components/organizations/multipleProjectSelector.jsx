import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/button';
import ProjectSelector from 'app/components/projectSelector';
import TextOverflow from 'app/components/textOverflow';
import space from 'app/styles/space';
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

  handleMultiSelect = (selected, checked, e) => {
    const {onChange} = this.props;
    onChange(selected.map(({id}) => parseInt(id, 10)));
    this.setState({hasChanges: true});
  };

  render() {
    const {className, value, projects} = this.props;
    const selectedProjectIds = new Set(value);

    const selected = projects.filter(project =>
      selectedProjectIds.has(parseInt(project.id, 10))
    );

    return (
      <ProjectSelector
        {...this.props}
        multi
        showUpdate
        selectedProjects={selected}
        projects={projects}
        onSelect={this.handleQuickSelect}
        onMultiSelect={this.handleMultiSelect}
        rootClassName={css`display: flex`}
        style={{margin: "1px 0 0 -1px", borderRadius: "0 0 4px 4px", width: "120%", zIndex: "-1"}}
        menuFooter={({actions}) => {
          if (!this.state.hasChanges && selected.length === 0) {
            return null;
          }

          return (
            <Footer>
              <Button
                priority="primary"
                tabIndex={1}
                size="small"
                type="button"
                disabled={!this.state.hasChanges}
                onClick={this.handleUpdate.bind(this, actions)}
              >
                {t('Update')}
              </Button>

              <Button
                size="small"
                type="button"
                disabled={selected.length === 0}
                onClick={this.props.onChange.bind(this, [])}
              >
                {t('Clear')}
              </Button>
            </Footer>
          );
        }}
      >
        {({getActorProps, selectedItem, activeProject, selectedProjects, isOpen}) => {
          const hasSelected = !!selectedProjects.length;
          const title = hasSelected
            ? selectedProjects.map(({slug}) => slug).join(', ')
            : t('Projects and Teams');
          return (
            <StyledHeaderItem active={hasSelected || isOpen} icon={<StyledInlineSvg src="icon-stack" />} {...getActorProps()}>
              {title}
            </StyledHeaderItem>
          );
        }}
      </ProjectSelector>
    );
  }
}

const StyledHeaderItem = styled(HeaderItem)`
  height: 100%;
  width: 300px;
`;

const StyledInlineSvg = styled(InlineSvg)`
  height: 18px;
  width: 18px;
`;

const Footer = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: ${space(0.5)} 0;
`;
