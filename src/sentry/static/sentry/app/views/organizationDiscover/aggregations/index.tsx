import * as React from 'react';
import styled from 'react-emotion';
import {t} from 'app/locale';
import space from 'app/styles/space';

const InlineSvg: any = require('app/components/inlineSvg').default;
const Link: any = require('app/components/links/link').default;
const Aggregation: any = require('./aggregation').default;

import {PlaceholderText, SelectListItem, AddText, SidebarLabel} from '../styles';
import {AggregationResult, Column} from './utils';

type AggregationsProps = {
  value: AggregationResult[];
  onChange: (value: AggregationResult[]) => void;
  columns: Column[];
  disabled: boolean;
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

  handleChange(val: AggregationResult, idx: number) {
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
              onChange={(val: AggregationResult) => this.handleChange(val, idx)}
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
