import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import TextField from 'app/components/forms/textField';
import NumberField from 'app/components/forms/numberField';
import SelectControl from 'app/components/forms/selectControl';
import Badge from 'app/components/badge';
import getDynamicText from 'app/utils/getDynamicText';

import Aggregations from '../aggregations';
import Conditions from '../conditions';
import {
  Fieldset,
  PlaceholderText,
  SidebarLabel,
  DocsSeparator,
  StyledInlineSvg,
  DiscoverDocs,
  DocsLabel,
  DocsIcon,
  DocsLink,
} from '../styles';
import Orderby from './orderby';
import {NON_CONDITIONS_FIELDS} from '../data';
import {getOrderbyFields} from '../utils';
import {SavedQuery, ReactSelectOption} from '../types';
import {QueryBuilder} from '../queryBuilder';

type QueryFieldsProps = {
  queryBuilder: QueryBuilder;
  onUpdateField: (filedType: string, value: any) => void;
  actions: any;
  isLoading: boolean;
  // savedQuery, savedQueryName, and onUpdateName are provided only when it's a saved search
  savedQuery?: SavedQuery;
  savedQueryName?: string;
  onUpdateName?: (name: string) => void;
};

export default class QueryFields extends React.Component<QueryFieldsProps> {
  getSummarizePlaceholder = () => {
    const {queryBuilder} = this.props;
    const query = queryBuilder.getInternal();
    const text =
      query.aggregations.length > 0
        ? t('Select fields')
        : t('No fields selected, showing all');
    return <PlaceholderText>{text}</PlaceholderText>;
  };

  optionRenderer = ({label, isTag}: ReactSelectOption) => {
    return (
      <Option>
        {label}
        {isTag && <Badge text="tag" />}
      </Option>
    );
  };

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
                value={getDynamicText({value: savedQueryName, fixed: 'query name'})}
                placeholder={t('Saved search name')}
                onChange={(val: string) => onUpdateName && onUpdateName(val)}
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
            multiple
            placeholder={this.getSummarizePlaceholder()}
            options={fieldOptions}
            optionRenderer={this.optionRenderer}
            value={currentQuery.fields}
            onChange={(val: ReactSelectOption[]) =>
              onUpdateField('fields', val.map(({value}) => value))
            }
            clearable
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
          <Orderby
            value={currentQuery.orderby}
            columns={getOrderbyFields(queryBuilder)}
            onChange={val => onUpdateField('orderby', val)}
            disabled={isLoading}
          />
        </Fieldset>
        <Fieldset>
          <NumberField
            name="limit"
            label={<SidebarLabel>{t('Limit')}</SidebarLabel>}
            placeholder="#"
            value={currentQuery.limit}
            onChange={(val: unknown) =>
              onUpdateField('limit', typeof val === 'number' ? val : null)
            }
            disabled={isLoading}
          />
        </Fieldset>
        <Fieldset>{actions}</Fieldset>
        <DocsSeparator />
        <DocsLink href="https://docs.sentry.io/product/discover/">
          <DiscoverDocs>
            <DocsIcon src="icon-docs" />
            <DocsLabel>{t('Discover Documentation')}</DocsLabel>
            <StyledInlineSvg src="icon-chevron-right" size="1em" />
          </DiscoverDocs>
        </DocsLink>
      </div>
    );
  }
}

const Option = styled('div')`
  display: flex;
  align-items: center;
`;
