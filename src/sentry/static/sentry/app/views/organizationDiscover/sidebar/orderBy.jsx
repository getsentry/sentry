import PropTypes from 'prop-types';
import React from 'react';

import SelectControl from 'app/components/forms/selectControl';
import {t} from 'app/locale';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import {PlaceholderText, SidebarLabel} from '../styles';

export default class OrderBy extends React.Component {
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
   * @param {Object} i.e. {direction: 'asc', field: 'id'}
   * @returns {String} i.e. 'id'
   */
  getExternal(value) {
    return `${value.direction === 'desc' ? '-' : ''}${value.field}`;
  }

  /**
   * @param {String} i.e.'id'
   * @returns {Object} i.e. {direction: 'asc', field: 'id'}
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
        <SidebarLabel htmlFor="orderby" className="control-label">
          {t('Order by')}
        </SidebarLabel>
        <Flex>
          <OrderByField>
            <SelectControl
              name="orderbyField"
              label={t('Order By')}
              placeholder={<PlaceholderText>{t('Order by...')}</PlaceholderText>}
              options={columns}
              value={field}
              onChange={val => this.updateField(val.value)}
              disabled={disabled}
              autosize={false}
            />
          </OrderByField>
          <OrderByValue>
            <SelectControl
              name="orderbyDirection"
              label={t('Order by Direction')}
              placeholder={<PlaceholderText>{t('asc or desc')}</PlaceholderText>}
              options={[{value: 'asc', label: 'asc'}, {value: 'desc', label: 'desc'}]}
              value={direction}
              onChange={val => this.updateDirection(val.value)}
              disabled={disabled}
              autosize={false}
            />
          </OrderByValue>
        </Flex>
      </React.Fragment>
    );
  }
}

const OrderByField = styled(Flex)`
  width: calc(100% / 3 * 2);
`;

const OrderByValue = styled(Flex)`
  width: calc(100% / 3);
`;
