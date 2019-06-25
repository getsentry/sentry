import React from 'react';

import {t} from 'app/locale';

import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';

import Aggregation from './aggregation';
import {PlaceholderText, SelectListItem, AddText, SidebarLabel} from '../styles';
import {SnubaResult, DiscoverBaseProps} from '../types';

type AggregationsProps = DiscoverBaseProps & {
  value: SnubaResult[];
  onChange: (value: SnubaResult[]) => void;
};

export default class Aggregations extends React.Component<AggregationsProps, any> {
  addRow() {
    this.props.onChange([...this.props.value, [null, null, null]]);
  }

  removeRow(idx: number) {
    const aggregations = this.props.value.slice();
    aggregations.splice(idx, 1);
    this.props.onChange(aggregations);
  }

  handleChange(val: SnubaResult, idx: number) {
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
              onChange={(val: SnubaResult) => this.handleChange(val, idx)}
              columns={columns}
              disabled={disabled}
            />
            <div>
              <a onClick={() => this.removeRow(idx)}>
                <InlineSvg src="icon-circle-close" height="38px" />
              </a>
            </div>
          </SelectListItem>
        ))}
      </div>
    );
  }
}
