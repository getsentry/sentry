import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'grid-emotion';

import Link from 'app/components/link';
import InlineSvg from 'app/components/inlineSvg';
import {t} from 'app/locale';

import Aggregation from './aggregation';
import {PlaceholderText, SelectListItem, AddText, SidebarLabel} from '../styles';

export default class Aggregations extends React.Component {
  static propTypes = {
    value: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
    columns: PropTypes.array,
    disabled: PropTypes.bool,
  };

  addRow() {
    this.props.onChange([...this.props.value, [null, null, null]]);
  }

  removeRow(idx) {
    const aggregations = this.props.value.slice();
    aggregations.splice(idx, 1);
    this.props.onChange(aggregations);
  }

  handleChange(val, idx) {
    const aggregations = this.props.value.slice();

    aggregations[idx] = val;

    this.props.onChange(aggregations);
  }

  render() {
    const {value, columns, disabled} = this.props;

    return (
      <div>
        <div>
          <SidebarLabel>{t('Aggregation')}</SidebarLabel>
          {!disabled && (
            <AddText>
              (<Link onClick={() => this.addRow()}>{t('Add')}</Link>)
            </AddText>
          )}
        </div>
        {!value.length && (
          <PlaceholderText>{t('None, showing raw event data')}</PlaceholderText>
        )}
        {value.map((aggregation, idx) => (
          <SelectListItem key={`${idx}_${aggregation[2]}`}>
            <Aggregation
              value={aggregation}
              onChange={val => this.handleChange(val, idx)}
              columns={columns}
              disabled={disabled}
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
