import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import NumberField from 'app/components/forms/numberField';
import SelectControl from 'app/components/forms/selectControl';

import Aggregations from '../aggregations';
import Conditions from '../conditions';
import {getOrderByOptions} from '../utils';
import {Fieldset, PlaceholderText, SidebarLabel} from '../styles';

export default class QueryFields extends React.Component {
  static propTypes = {
    queryBuilder: PropTypes.object.isRequired,
    onUpdateField: PropTypes.func.isRequired,
    actions: PropTypes.node.isRequired,
  };

  getSummarizePlaceholder = () => {
    const {queryBuilder} = this.props;
    const query = queryBuilder.getInternal();
    const text =
      query.aggregations.length > 0
        ? t('Select fields')
        : t('No fields selected, showing all');
    return <PlaceholderText>{text}</PlaceholderText>;
  };

  render() {
    const {queryBuilder, onUpdateField, actions} = this.props;

    const currentQuery = queryBuilder.getInternal();
    const columns = queryBuilder.getColumns();
    // Do not allow conditions on project_id or project_name fields
    const columnsForConditions = columns.filter(
      ({name}) => !['project_id', 'project_name'].includes(name)
    );

    const fieldOptions = columns.map(({name}) => ({
      value: name,
      label: name,
    }));

    return (
      <React.Fragment>
        <Fieldset>
          <SidebarLabel htmlFor="fields" className="control-label">
            {t('Summarize')}
          </SidebarLabel>
          <SelectControl
            name="fields"
            multiple={true}
            placeholder={this.getSummarizePlaceholder()}
            options={fieldOptions}
            value={currentQuery.fields}
            onChange={val => onUpdateField('fields', val.map(({value}) => value))}
            clearable={true}
          />
        </Fieldset>
        <Fieldset>
          <Aggregations
            value={currentQuery.aggregations}
            columns={columns}
            onChange={val => onUpdateField('aggregations', val)}
          />
        </Fieldset>
        <Fieldset>
          <Conditions
            value={currentQuery.conditions}
            columns={columnsForConditions}
            onChange={val => onUpdateField('conditions', val)}
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
            value={currentQuery.orderby}
            onChange={val => onUpdateField('orderby', val.value)}
          />
        </Fieldset>
        <Fieldset>
          <NumberField
            name="limit"
            label={<SidebarLabel>{t('Limit')}</SidebarLabel>}
            placeholder="#"
            value={currentQuery.limit}
            onChange={val => onUpdateField('limit', typeof val === 'number' ? val : null)}
          />
        </Fieldset>
        <Fieldset>{actions}</Fieldset>
      </React.Fragment>
    );
  }
}
