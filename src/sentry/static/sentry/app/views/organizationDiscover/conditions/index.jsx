import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'grid-emotion';

import Link from 'app/components/link';
import InlineSvg from 'app/components/inlineSvg';
import {t} from 'app/locale';

import Condition from './condition';
import {PlaceholderText, SelectListItem, AddText} from '../styles';

export default class Conditions extends React.Component {
  static propTypes = {
    value: PropTypes.arrayOf(PropTypes.array).isRequired,
    onChange: PropTypes.func.isRequired,
    columns: PropTypes.array,
  };

  addRow() {
    this.props.onChange([...this.props.value, [null, null, null]]);
  }

  removeRow(idx) {
    const conditions = this.props.value.slice();
    conditions.splice(idx, 1);
    this.props.onChange(conditions);
  }

  handleChange(val, idx) {
    const conditions = this.props.value.slice();

    conditions[idx] = val;

    this.props.onChange(conditions);
  }

  render() {
    const {value, columns} = this.props;

    return (
      <div>
        <div>
          <strong>{t('Conditions')}</strong>
          <AddText>
            (<Link onClick={() => this.addRow()}>{t('Add')}</Link>)
          </AddText>
        </div>
        {!value.length && (
          <PlaceholderText>{t('None, showing all events')}</PlaceholderText>
        )}
        {value.map((condition, idx) => (
          <SelectListItem key={`${idx}_${condition[2]}`}>
            <Condition
              value={condition}
              onChange={val => this.handleChange(val, idx)}
              columns={columns}
            />
            <Box ml={1}>
              <a onClick={() => this.removeRow(idx)}>
                <InlineSvg src="icon-circle-close" height="38px" />
              </a>
            </Box>
          </SelectListItem>
        ))}
      </div>
    );
  }
}
