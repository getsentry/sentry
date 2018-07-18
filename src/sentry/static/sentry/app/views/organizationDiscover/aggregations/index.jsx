import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'grid-emotion';

import Link from 'app/components/link';
import InlineSvg from 'app/components/inlineSvg';
import {t} from 'app/locale';

import Aggregation from './aggregation';
import {PlaceholderText, SelectListItem, AddText} from '../styles';

export default class Aggregations extends React.Component {
  static propTypes = {
    value: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
    columns: PropTypes.array,
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
    const {value, columns} = this.props;

    return (
      <div>
        <div>
          <strong>{t('Aggregation')}</strong>
          <AddText>
            (<Link onClick={() => this.addRow()}>{t('Add')}</Link>)
          </AddText>
        </div>
        {!value.length && <PlaceholderText>{t('None')}</PlaceholderText>}
        {value.map((aggregation, idx) => (
          <SelectListItem key={idx}>
            <Aggregation
              value={aggregation}
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
