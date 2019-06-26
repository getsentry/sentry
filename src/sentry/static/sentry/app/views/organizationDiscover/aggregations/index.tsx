import React from 'react';

import {t} from 'app/locale';

import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';

import Aggregation from './aggregation';
import {PlaceholderText, SelectListItem, AddText, SidebarLabel} from '../styles';
import {AggregationData, DiscoverBaseProps} from '../types';

type AggregationsProps = DiscoverBaseProps & {
  value: AggregationData[];
  onChange: (value: AggregationData[]) => void;
};

export default class Aggregations extends React.Component<AggregationsProps, any> {
  addRow() {
    const aggregations: any[] = [...this.props.value, [null, null, null]];
    this.props.onChange(aggregations);
  }

  removeRow(idx: number) {
    const aggregations = this.props.value.slice();
    aggregations.splice(idx, 1);
    this.props.onChange(aggregations);
  }

  handleChange(val: AggregationData, idx: number) {
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
              onChange={(val: AggregationData) => this.handleChange(val, idx)}
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
