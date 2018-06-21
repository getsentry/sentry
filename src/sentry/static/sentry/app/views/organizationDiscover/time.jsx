import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';

import DateTimeField from 'app/components/forms/dateTimeField';
import DropdownLink from 'app/components/dropdownLink';
import Button from 'app/components/buttons/button';
import {t} from 'app/locale';

export default class TimeRange extends React.Component {
  static propTypes = {
    start: PropTypes.string,
    end: PropTypes.string,
    updateField: PropTypes.func,
    runQuery: PropTypes.func,
  };

  formatDate(date) {
    return moment(date).format('MMMM D, h:mm a');
  }

  render() {
    const {start, end, updateField, runQuery} = this.props;
    const summary = `${this.formatDate(start)} to ${this.formatDate(end)}`;

    return (
      <Time direction="column" justify="center">
        <label>{t('Time range')}</label>
        <DropdownLink title={summary} keepMenuOpen={true} anchorRight={true}>
          <Box p={2}>
            update time range (UTC)
            <DateTimeField
              name="start"
              label={t('From')}
              value={start}
              onChange={val => updateField('start', val)}
            />
            <DateTimeField
              name="end"
              label={t('To')}
              value={end}
              onChange={val => updateField('end', val)}
            />
            <Button onClick={runQuery}>{t('Update')}</Button>
          </Box>
        </DropdownLink>
      </Time>
    );
  }
}

const Time = styled(Flex)`
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
