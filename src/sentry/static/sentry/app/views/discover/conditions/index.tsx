import React from 'react';

import InlineSvg from 'app/components/inlineSvg';
import {t} from 'app/locale';
import Link from 'app/components/links/link';

import ConditionRow from './condition';
import {PlaceholderText, SelectListItem, AddText, SidebarLabel} from '../styles';
import {Condition, DiscoverBaseProps} from '../types';

type ConditionsProps = DiscoverBaseProps & {
  value: Condition[];
  onChange: (value: [any, any, any][]) => void;
};

export default class Conditions extends React.Component<ConditionsProps> {
  addRow() {
    this.props.onChange([...this.props.value, [null, null, null]]);
  }

  removeRow(idx: number) {
    const conditions = this.props.value.slice();
    conditions.splice(idx, 1);
    this.props.onChange(conditions);
  }

  handleChange(val: Condition, idx: number) {
    const conditions = this.props.value.slice();

    conditions[idx] = val;

    this.props.onChange(conditions);
  }

  render() {
    const {value, columns, disabled} = this.props;

    return (
      <div>
        <div>
          <SidebarLabel>{t('Conditions')}</SidebarLabel>
          {!disabled && (
            <AddText>
              (
              <Link
                to=""
                data-test-id="conditions-add-text-link"
                onClick={() => this.addRow()}
              >
                {t('Add')}
              </Link>
              )
            </AddText>
          )}
        </div>
        {!value.length && (
          <PlaceholderText>{t('None, showing all events')}</PlaceholderText>
        )}
        {value.map((condition, idx) => (
          <SelectListItem key={`${idx}_${condition[2]}`}>
            <ConditionRow
              value={condition}
              onChange={(val: Condition) => this.handleChange(val, idx)}
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
