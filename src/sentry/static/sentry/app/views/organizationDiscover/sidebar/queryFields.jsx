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
    onUpdateField: PropTypes.func.isRequired,
    actions: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.node.isRequired,
        priority: PropTypes.string,
        align: PropTypes.oneOf(['left', 'right']).isRequired,
        onClick: PropTypes.func.isRequired,
        isBusy: PropTypes.bool,
      })
    ).isRequired,
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

  renderAction(direction) {
    const boxProps = {
      mr: direction === 'left' ? 1 : 0,
      ml: direction === 'right' ? 1 : 0,
    };

    return function renderAction(action, idx) {
      return (
        <Box key={idx} {...boxProps}>
          <Button
            size="xsmall"
            onClick={action.onClick}
            priority={action.priority}
            busy={action.isBusy}
          >
            {action.title}
            {action.isBusy && <ButtonSpinner />}
          </Button>
        </Box>
      );
    };
  }

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

    const leftActions = actions.filter(action => action.align === 'left');
    const rightActions = actions.filter(action => action.align === 'right');

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
        <Fieldset>
          <Flex justify="space-between">
            <Flex>{leftActions.map(this.renderAction('left'))}</Flex>
            <Flex>{rightActions.map(this.renderAction('right'))}</Flex>
          </Flex>
        </Fieldset>
      </React.Fragment>
    );
  }
}
