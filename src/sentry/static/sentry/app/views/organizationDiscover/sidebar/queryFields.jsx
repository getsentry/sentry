import PropTypes from 'prop-types';
import React from 'react';
import {Flex, Box} from 'grid-emotion';

import {t} from 'app/locale';
import Button from 'app/components/button';
import NumberField from 'app/components/forms/numberField';
import SelectControl from 'app/components/forms/selectControl';

import Aggregations from '../aggregations';
import Conditions from '../conditions';
import {getOrderByOptions} from '../utils';
import {Fieldset, PlaceholderText, SidebarLabel, ButtonSpinner} from '../styles';

export default class QueryFields extends React.Component {
  static propTypes = {
    queryBuilder: PropTypes.object.isRequired,
    isFetchingQuery: PropTypes.bool.isRequired,
    updateField: PropTypes.func.isRequired,
    runQuery: PropTypes.func.isRequired,
    reset: PropTypes.func.isRequired,
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
    const {queryBuilder, isFetchingQuery, updateField, runQuery, reset} = this.props;

    const currentQuery = queryBuilder.getInternal();
    const columns = queryBuilder.getColumns();
    // Do not allow conditions on projectID field
    const columnsForConditions = columns.filter(({name}) => name !== 'project_id');

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
            onChange={val => updateField('fields', val.map(({value}) => value))}
            clearable={true}
          />
        </Fieldset>
        <Fieldset>
          <Aggregations
            value={currentQuery.aggregations}
            columns={columns}
            onChange={val => updateField('aggregations', val)}
          />
        </Fieldset>
        <Fieldset>
          <Conditions
            value={currentQuery.conditions}
            columns={columnsForConditions}
            onChange={val => updateField('conditions', val)}
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
            onChange={val => updateField('orderby', val.value)}
          />
        </Fieldset>
        <Fieldset>
          <NumberField
            name="limit"
            label={<SidebarLabel>{t('Limit')}</SidebarLabel>}
            placeholder="#"
            value={currentQuery.limit}
            onChange={val => updateField('limit', typeof val === 'number' ? val : null)}
          />
        </Fieldset>
        <Fieldset>
          <Flex>
            <Button
              size="xsmall"
              onClick={runQuery}
              priority="primary"
              busy={isFetchingQuery}
            >
              {t('Run')}
              {isFetchingQuery && <ButtonSpinner />}
            </Button>
            <Box ml={1}>
              <Button size="xsmall" onClick={reset}>
                {t('Reset')}
              </Button>
            </Box>
          </Flex>
        </Fieldset>
      </React.Fragment>
    );
  }
}
