import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled, {cx} from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/button';
import ProjectSelector from 'app/components/projectSelector';
import TextOverflow from 'app/components/textOverflow';
import space from 'app/styles/space';

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
      <HeaderItem className={className} label={t('Project(s)')}>
        <ProjectSelector
          {...this.props}
          multi
          multiOnly
          showUpdate
          selectedProjects={selected}
          projects={projects}
          onSelect={this.handleMultiSelect}
          onMultiSelect={this.handleMultiSelect}
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
                  onClick={this.handleUpdate.bind(this, actions)}
                >
                  {t('Update')}
                </Button>

                {selected.length > 0 && (
                  <Button
                    size="small"
                    type="button"
                    onClick={this.props.onChange.bind(this, [])}
                  >
                    {t('Clear')}
                  </Button>
                )}
              </Footer>
            );
          }}
        >
          {({getActorProps, selectedItem, activeProject, selectedProjects}) => {
            const hasSelected = !!selectedProjects.length;
            const title = hasSelected
              ? selectedProjects.map(({slug}) => slug).join(', ')
              : t('None selected, using all');
            return (
              <React.Fragment>
                <Flex {...getActorProps()}>
                  <Title>{title}</Title>
                  <ArrowDown />
                </Flex>
              </React.Fragment>
            );
          }}
        </ProjectSelector>
      </HeaderItem>
    );
  }
}
const ArrowDown = styled(({className, ...props}) => (
  <i className={cx('icon-arrow-down', className)} {...props} />
))`
  margin-left: ${space(0.5)};
`;

const Title = styled(TextOverflow)`
  width: 240px;
`;

const Footer = styled(Flex)`
  justify-content: space-between;
  padding: ${space(0.5)} 0;
`;
