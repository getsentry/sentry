import React from 'react';
import {components as selectComponents} from 'react-select';
import styled from '@emotion/styled';

import Badge from 'app/components/badge';
import NumberField from 'app/components/forms/numberField';
import SelectControl from 'app/components/forms/selectControl';
import TextField from 'app/components/forms/textField';
import {IconChevron, IconDocs} from 'app/icons';
import {t} from 'app/locale';
import getDynamicText from 'app/utils/getDynamicText';

import Aggregations from '../aggregations';
import Conditions from '../conditions';
import {NON_CONDITIONS_FIELDS} from '../data';
import {QueryBuilder} from '../queryBuilder';
import {
  DiscoverDocs,
  DocsLabel,
  DocsLink,
  DocsSeparator,
  Fieldset,
  PlaceholderText,
  SidebarLabel,
} from '../styles';
import {ReactSelectOption, SavedQuery} from '../types';
import {getOrderbyFields} from '../utils';

import Orderby from './orderby';

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

  optionRenderer = ({
    label,
    data,
    ...props
  }: React.ComponentProps<typeof selectComponents.Option>) => {
    return (
      <selectComponents.Option label={label} data={data} {...props}>
        {label}
        {data.isTag && <Badge text="tag" />}
      </selectComponents.Option>
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
                onChange={(val: string | number | boolean) =>
                  onUpdateName && onUpdateName(`${val}`)
                }
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
            components={{
              Option: this.optionRenderer,
            }}
            value={currentQuery.fields}
            onChange={(val: ReactSelectOption[]) =>
              onUpdateField(
                'fields',
                val.map(({value}) => value)
              )
            }
            clearable
            disabled={isLoading}
            styles={{
              option(provided: React.CSSProperties) {
                return {
                  ...provided,
                  display: 'flex',
                  alignItems: 'center',
                };
              },
            }}
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
            <IconDocs size="sm" />
            <DocsLabel>{t('Discover Documentation')}</DocsLabel>
            <StyledIconChevron direction="right" size="1em" />
          </DiscoverDocs>
        </DocsLink>
      </div>
    );
  }
}

const StyledIconChevron = styled(IconChevron)`
  justify-content: flex-end;
`;
