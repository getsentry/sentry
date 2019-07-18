import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import SelectControl from 'app/components/forms/selectControl';
import space from 'app/styles/space';
import {SidebarLabel} from '../styles';
import {DiscoverBaseProps, ReactSelectValue} from '../types';

type OrderbyProps = DiscoverBaseProps & {
  value: string;
  onChange: (value: string) => void;
};

type OrderbyValue = {
  direction: string;
  field: string;
};

export default class Orderby extends React.Component<OrderbyProps> {
  updateField(field: any) {
    const orderby = this.getInternal(this.props.value);
    orderby.field = field;
    this.props.onChange(this.getExternal(orderby));
  }

  updateDirection(direction: string) {
    const orderby = this.getInternal(this.props.value);
    orderby.direction = direction;
    this.props.onChange(this.getExternal(orderby));
  }

  /**
   * @param value Object containing orderby information
   */
  getExternal(value: OrderbyValue) {
    return `${value.direction === 'desc' ? '-' : ''}${value.field}`;
  }

  /**
   * @param value String containing orderby information
   */
  getInternal(value: string) {
    const direction = value.startsWith('-') ? 'desc' : 'asc';
    const field = value.replace(/^-/, '');
    return {
      direction,
      field,
    } as OrderbyValue;
  }

  render() {
    const {disabled, columns, value} = this.props;

    const {direction, field} = this.getInternal(value);

    return (
      <React.Fragment>
        <SidebarLabel className="control-label">{t('Order by')}</SidebarLabel>
        <Container>
          <OrderbyField>
            <SelectControl
              name="orderbyField"
              options={columns}
              value={field}
              onChange={(val: ReactSelectValue) => this.updateField(val.value)}
              disabled={disabled}
            />
          </OrderbyField>
          <OrderbyValue>
            <SelectControl
              name="orderbyDirection"
              options={[{value: 'asc', label: 'asc'}, {value: 'desc', label: 'desc'}]}
              value={direction}
              onChange={(val: ReactSelectValue) => this.updateDirection(val.value)}
              disabled={disabled}
            />
          </OrderbyValue>
        </Container>
      </React.Fragment>
    );
  }
}

const Container = styled('div')`
  display: flex;
`;

const OrderbyField = styled('div')`
  width: calc(100% / 3 * 2);
  padding-right: ${space(1)};
`;

const OrderbyValue = styled('div')`
  width: calc(100% / 3);
`;
