import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';

import DateTimeField from 'app/components/forms/dateTimeField';
import DropdownLink from 'app/components/dropdownLink';
import Button from 'app/components/buttons/button';
import {t} from 'app/locale';

class TimeRangeSelector extends React.Component {
  static propTypes = {
    start: PropTypes.string,
    end: PropTypes.string,
    onChange: PropTypes.func,
    onUpdate: PropTypes.func,
  };

  formatDate(date) {
    return moment(date).format('MMMM D, h:mm a');
  }

  render() {
    const {className, start, end, onChange, onUpdate} = this.props;
    const summary = `${this.formatDate(start)} to ${this.formatDate(end)}`;

    return (
      <Flex direction="column" justify="center" className={className}>
        <label>{t('Time range')}</label>
        <DropdownLink title={summary} keepMenuOpen={true} anchorRight={true}>
          <Box p={2}>
            update time range (UTC)
            <DateTimeField
              name="start"
              label={t('From')}
              value={start}
              onChange={val => onChange('start', val)}
            />
            <DateTimeField
              name="end"
              label={t('To')}
              value={end}
              onChange={val => onChange('end', val)}
            />
            <Button onClick={onUpdate}>{t('Update')}</Button>
          </Box>
        </DropdownLink>
      </Flex>
    );
  }
}

export default styled(TimeRangeSelector)`
  text-align: right;
  label {
    font-weight: 400;
    font-size: 13px;
    color: #afa3bb;
    margin-bottom: 12px;
  }
  .dropdown-actor-title {
    font-size: 15px;
    height: auto;
    color: ${p => p.theme.button.default.colorActive};
  }
`;
