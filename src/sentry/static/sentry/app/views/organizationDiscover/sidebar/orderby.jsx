import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import {t} from 'app/locale';
import SelectControl from 'app/components/forms/selectControl';
import space from 'app/styles/space';
import {SidebarLabel} from '../styles';

export default class Orderby extends React.Component {
  static propTypes = {
    value: PropTypes.string.isRequired,
    columns: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
  };

  updateField(field) {
    const orderby = this.getInternal(this.props.value);
    orderby.field = field;
    this.props.onChange(this.getExternal(orderby));
  }

  updateDirection(direction) {
    const orderby = this.getInternal(this.props.value);
    orderby.direction = direction;
    this.props.onChange(this.getExternal(orderby));
  }

  /**
   * @param {Object} value Object containing orderby information
   * @returns {String}
   */
  getExternal(value) {
    return `${value.direction === 'desc' ? '-' : ''}${value.field}`;
  }

  /**
   * @param {String} value String containing orderby information
   * @returns {Object}
   */
  getInternal(value) {
    const direction = value.startsWith('-') ? 'desc' : 'asc';
    const field = value.replace(/^-/, '');
    return {
      direction,
      field,
    };
  }

  render() {
    const {disabled, columns, value} = this.props;

    const {direction, field} = this.getInternal(value);

    return (
      <React.Fragment>
        <SidebarLabel className="control-label">{t('Order by')}</SidebarLabel>
        <Flex>
          <OrderbyField>
            <SelectControl
              name="orderbyField"
              options={columns}
              value={field}
              onChange={val => this.updateField(val.value)}
              disabled={disabled}
            />
          </OrderbyField>
          <OrderbyValue>
            <SelectControl
              name="orderbyDirection"
              options={[{value: 'asc', label: 'asc'}, {value: 'desc', label: 'desc'}]}
              value={direction}
              onChange={val => this.updateDirection(val.value)}
              disabled={disabled}
            />
          </OrderbyValue>
        </Flex>
      </React.Fragment>
    );
  }
}

const OrderbyField = styled('div')`
  width: calc(100% / 3 * 2);
  padding-right: ${space(1)};
`;

const OrderbyValue = styled('div')`
  width: calc(100% / 3);
`;
