import PropTypes from 'prop-types';
import React from 'react';

import SelectControl from 'app/components/forms/selectControl';
import {t} from 'app/locale';

import {getOrderByOptions} from '../utils';
import {PlaceholderText, SidebarLabel} from '../styles';

export default class OrderBy extends React.Component {
  static propTypes = {
    queryBuilder: PropTypes.object.isRequired,
    onUpdateField: PropTypes.func.isRequired,
    disabled: PropTypes.bool.isRequired,
  };

  constructor(props) {
    super(props);

    let orderby = this.props.queryBuilder.getInternal().orderby;
    const desc = orderby.startsWith('-') ? 'desc' : 'asc';
    orderby = orderby.replace(/^-/, '');

    this.state = {
      orderby,
      order: desc,
    };
  }

  updateOrderBy(field, value) {
    let orderby;
    if (value === 'desc' || value === 'asc') {
      this.setState({order: value});
      orderby = value === 'desc' ? '-'.concat(this.state.orderby) : this.state.orderby;
      this.props.onUpdateField('orderby', orderby);
    } else if (field === 'orderby') {
      orderby = this.state.order === 'desc' ? '-'.concat(value) : value;
      this.setState({orderby});
      this.props.onUpdateField('orderby', orderby);
    }
  }

  render() {
    const {disabled, queryBuilder} = this.props;

    return (
      <React.Fragment>
        <SidebarLabel htmlFor="orderby" className="control-label">
          {t('Order by')}
        </SidebarLabel>
        <SelectControl
          name="orderby"
          label={t('Order By')}
          placeholder={<PlaceholderText>{t('Order by...')}</PlaceholderText>}
          options={getOrderByOptions(queryBuilder)}
          value={this.state.orderby}
          onChange={val => this.updateOrderBy('orderby', val.value)}
          disabled={disabled}
        />
        <SelectControl
          name="orderby"
          label={t('asc')}
          placeholder={<PlaceholderText>{t('asc or desc')}</PlaceholderText>}
          options={[{name: 'asc', label: 'asc'}, {name: 'desc', label: 'desc'}]}
          value={this.state.order}
          onChange={val => this.updateOrderBy('asc_desc', val.name)}
          disabled={disabled}
        />
      </React.Fragment>
    );
  }
}
