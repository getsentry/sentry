import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import ProjectSelector from 'app/components/projectSelector';

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
  }

  onUpdate = () => {
    this.props.onUpdate();
  };

  handleMultiSelect = (selected, checked, e) => {
    const {onChange} = this.props;
    onChange(selected.map(({id}) => parseInt(id, 10)));
  };

  render() {
    const {className, value, projects} = this.props;
    const selectedProjectIds = new Set(value);

    const selected = projects.filter(project =>
      selectedProjectIds.has(parseInt(project.id, 10))
    );

    return (
      <HeaderItem className={className} label={t('Project(s)')}>
        <ProjectSelector
          {...this.props}
          multi
          selectedProjects={selected}
          projects={projects}
          onSelect={this.handleMultiSelect}
          onMultiSelect={this.handleMultiSelect}
        >
          {({getActorProps, selectedItem, activeProject, selectedProjects}) => (
            <React.Fragment>
              <Title {...getActorProps()}>
                {selectedProjects.length
                  ? selectedProjects.map(({slug}) => slug).join(', ')
                  : t('None selected, using all')}
              </Title>
              <i className="icon-arrow-down" />
            </React.Fragment>
          )}
        </ProjectSelector>
      </HeaderItem>
    );
  }
}

const Title = styled.span`
  padding-right: 40px;
  max-width: 250px;
`;
