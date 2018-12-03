import PropTypes from 'prop-types';
import React from 'react';
import {Flex} from 'grid-emotion';

import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import TextField from 'app/components/forms/textField';
import NumberField from 'app/components/forms/numberField';
import SelectControl from 'app/components/forms/selectControl';
import Badge from 'app/components/badge';

import Aggregations from '../aggregations';
import Conditions from '../conditions';
import {getOrderByOptions} from '../utils';
import {Fieldset, PlaceholderText, SidebarLabel} from '../styles';
import {NON_CONDITIONS_FIELDS} from '../data';

export default class QueryFields extends React.Component {
  static propTypes = {
    queryBuilder: PropTypes.object.isRequired,
    onUpdateField: PropTypes.func.isRequired,
    actions: PropTypes.node.isRequired,
    isLoading: PropTypes.bool.isRequired,
    // savedQuery, savedQueryName, and onUpdateName are provided only when it's a saved search
    savedQuery: SentryTypes.DiscoverSavedQuery,
    savedQueryName: PropTypes.string,
    onUpdateName: PropTypes.func,
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
    console.log("state: ", this.state);
  }

  getSummarizePlaceholder = () => {
    const {queryBuilder} = this.props;
    const query = queryBuilder.getInternal();
    const text =
      query.aggregations.length > 0
        ? t('Select fields')
        : t('No fields selected, showing all');
    return <PlaceholderText>{text}</PlaceholderText>;
  };

  optionRenderer = ({label, isTag}) => {
    return (
      <Flex align="center">
        {label}
        {isTag && <Badge text="tag" />}
      </Flex>
    );
  };

  updateOrderBy(field, value) {
    console.log('update orderby() field, value:', field, value)
    let orderby;
    if (value === 'desc' || value === 'asc') {
      this.setState({order: value})
      orderby = value === 'desc' ? '-'.concat(this.state.orderby) : this.state.orderby;
      this.props.onUpdateField('orderby', orderby);
    } else if (field === 'orderby') {
      orderby = this.state.order === 'desc' ? '-'.concat(value) : value;
      this.setState({orderby});
      this.props.onUpdateField('orderby', orderby);
    }
  }

  render() {
    const {
      queryBuilder,
      onUpdateField,
      actions,
      isLoading,
      savedQuery,
      savedQueryName,
      onUpdateName,
    } = this.props;

    const currentQuery = queryBuilder.getInternal();
    const columns = queryBuilder.getColumns();
    // Do not allow conditions on certain fields
    const columnsForConditions = columns.filter(
      ({name}) => !NON_CONDITIONS_FIELDS.includes(name)
    );

    const fieldOptions = columns.map(({name, isTag}) => ({
      value: name,
      label: name,
      isTag,
    }));

    console.log(currentQuery);

    return (
      <div>
        {savedQuery && (
          <Fieldset>
            <React.Fragment>
              <SidebarLabel htmlFor="name" className="control-label">
                {t('Name')}
              </SidebarLabel>
              <TextField
                name="name"
                value={savedQueryName}
                placeholder={t('Saved search name')}
                onChange={val => onUpdateName(val)}
              />
            </React.Fragment>
          </Fieldset>
        )}
        <Fieldset>
          <SidebarLabel htmlFor="fields" className="control-label">
            {t('Summarize')}
          </SidebarLabel>
          <SelectControl
            name="fields"
            multiple={true}
            placeholder={this.getSummarizePlaceholder()}
            options={fieldOptions}
            optionRenderer={this.optionRenderer}
            value={currentQuery.fields}
            onChange={val => onUpdateField('fields', val.map(({value}) => value))}
            clearable={true}
            disabled={isLoading}
          />
        </Fieldset>
        <Fieldset>
          <Aggregations
            value={currentQuery.aggregations}
            columns={columns}
            onChange={val => onUpdateField('aggregations', val)}
            disabled={isLoading}
          />
        </Fieldset>
        <Fieldset>
          <Conditions
            value={currentQuery.conditions}
            columns={columnsForConditions}
            onChange={val => onUpdateField('conditions', val)}
            disabled={isLoading}
          />
        </Fieldset>
        <Fieldset>
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
            disabled={isLoading}
          />
          <SelectControl
            name="orderby"
            label={t('asc')}
            placeholder={<PlaceholderText>{t('asc or desc')}</PlaceholderText>}
            options={[{name: 'asc', label: 'asc'}, {name: 'desc', label: 'desc'}]}
            value={this.state.order}
            onChange={val => this.updateOrderBy('asc_desc', val.name)}
            disabled={isLoading}
          />
        </Fieldset>
        <Fieldset>
          <NumberField
            name="limit"
            label={<SidebarLabel>{t('Limit')}</SidebarLabel>}
            placeholder="#"
            value={currentQuery.limit}
            onChange={val => onUpdateField('limit', typeof val === 'number' ? val : null)}
            disabled={isLoading}
          />
        </Fieldset>
        <Fieldset>{actions}</Fieldset>
      </div>
    );
  }
}
