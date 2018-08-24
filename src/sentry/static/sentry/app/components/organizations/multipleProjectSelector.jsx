import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import {Box} from 'grid-emotion';

import DropdownLink from 'app/components/dropdownLink';
import Button from 'app/components/buttons/button';
import MultiSelectField from 'app/components/forms/multiSelectField';
import {t} from 'app/locale';

import HeaderItem from './headerItem';

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
    const {className, value, projects, onChange} = this.props;
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
          anchorRight={true}
          isOpen={this.state.isOpen}
          onOpen={() => this.setState({isOpen: true})}
          onClickOutside={() => this.setState({isOpen: false})}
        >
          <Box p={2}>
            <Box mb={1}>
              <MultiSelectField
                name="projects"
                label={t('Searched projects')}
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
