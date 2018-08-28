import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import {Box} from 'grid-emotion';

import DropdownLink from 'app/components/dropdownLink';
import Button from 'app/components/button';
import MultiSelectField from 'app/components/forms/multiSelectField';
import {t} from 'app/locale';

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
      isOpen: false,
    };
  }

  formatDate(date) {
    return moment(date).format('MMMM D, h:mm a');
  }

  onUpdate = () => {
    this.props.onUpdate();
    this.setState({
      isOpen: false,
    });
  };

  render() {
    const {className, anchorRight, value, projects, onChange} = this.props;
    const selectedProjectIds = new Set(value);

    const projectList = projects
      .filter(project => selectedProjectIds.has(parseInt(project.id, 10)))
      .map(project => project.slug);

    const summary = projectList.length
      ? `${projectList.join(', ')}`
      : t('None selected, using all');

    const options = projects.map(project => {
      return {
        value: parseInt(project.id, 10),
        label: project.slug,
      };
    });

    return (
      <HeaderItem className={className} label={t('Projects')}>
        <DropdownLink
          title={summary}
          anchorRight={anchorRight}
          isOpen={this.state.isOpen}
          keepMenuOpen={true}
          onOpen={() => this.setState({isOpen: true})}
          onClose={() => this.setState({isOpen: false})}
        >
          <Box p={2}>
            <Box mb={1}>
              <Box mb={1}>{t('Searched project list')}</Box>
              <MultiSelectField
                name="projects"
                value={value}
                options={options}
                onChange={onChange}
              />
            </Box>
            <Button onClick={this.onUpdate}>{t('Update')}</Button>
          </Box>
        </DropdownLink>
      </HeaderItem>
    );
  }
}
