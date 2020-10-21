import { Component } from 'react';

import {t} from 'app/locale';
import {IconClose} from 'app/icons/iconClose';
import Link from 'app/components/links/link';

import AggregationRow from './aggregation';
import {PlaceholderText, SelectListItem, AddText, SidebarLabel} from '../styles';
import {Aggregation, DiscoverBaseProps} from '../types';

type AggregationsProps = DiscoverBaseProps & {
  value: Aggregation[];
  onChange: (value: Aggregation[]) => void;
};

export default class Aggregations extends Component<AggregationsProps> {
  addRow() {
    const aggregations: any[] = [...this.props.value, [null, null, null]];
    this.props.onChange(aggregations);
  }

  removeRow(idx: number) {
    const aggregations = this.props.value.slice();
    aggregations.splice(idx, 1);
    this.props.onChange(aggregations);
  }

  handleChange(val: Aggregation, idx: number) {
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
              (
              <Link
                to=""
                data-test-id="aggregation-add-text-link"
                onClick={() => this.addRow()}
              >
                {t('Add')}
              </Link>
              )
            </AddText>
          )}
        </div>
        {!value.length && (
          <PlaceholderText>{t('None, showing raw event data')}</PlaceholderText>
        )}
        {value.map((aggregation, idx) => (
          <SelectListItem key={`${idx}_${aggregation[2]}`}>
            <AggregationRow
              value={aggregation}
              onChange={(val: Aggregation) => this.handleChange(val, idx)}
              columns={columns}
              disabled={disabled}
            />
            <div>
              <Link to="" onClick={() => this.removeRow(idx)}>
                <IconClose isCircled />
              </Link>
            </div>
          </SelectListItem>
        ))}
      </div>
    );
  }
}
