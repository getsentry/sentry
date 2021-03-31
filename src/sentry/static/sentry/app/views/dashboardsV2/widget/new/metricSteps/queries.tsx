import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import SmartSearchBar from 'app/components/smartSearchBar';
import {IconAdd, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Tag} from 'app/types';
import Field from 'app/views/settings/components/forms/field';
import SelectField from 'app/views/settings/components/forms/selectField';

import {Aggregation, metricGroupByOptions, metricTags} from '../utils';

type MetricQuery = {
  tags: string;
  groupBy: string;
  aggregation: string;
};

type Props = {
  queries: MetricQuery[];
  onRemoveQuery: (index: number) => void;
  onAddQuery: () => void;
  onChangeQuery: (queryIndex: number, metricQuery: MetricQuery) => void;
};

function Queries({queries, onRemoveQuery, onAddQuery, onChangeQuery}: Props) {
  function handleFieldChange(queryIndex: number, field: keyof MetricQuery) {
    const widgetQuery = queries[queryIndex];

    return function handleChange(value: string) {
      const newQuery = {...widgetQuery, [field]: value};
      onChangeQuery(queryIndex, newQuery);
    };
  }

  function getTagValue({key}: Tag, _query: string, _params: object) {
    return Promise.resolve([metricTags[key as keyof typeof metricTags].value]);
  }

  return (
    <div>
      {queries.map((metricQuery, queryIndex) => {
        return (
          <Field
            key={queryIndex}
            inline={false}
            style={{paddingRight: 0}}
            flexibleControlStateSize
            stacked
          >
            <Fields displayDeleteButton={queries.length > 1}>
              <SmartSearchBar
                hasRecentSearches
                maxSearchItems={5}
                placeholder={t('Search for tag')}
                supportedTags={metricTags}
                onChange={value => handleFieldChange(queryIndex, 'tags')(value)}
                onBlur={value => handleFieldChange(queryIndex, 'tags')(value)}
                onGetTagValues={getTagValue}
                excludeEnvironment
              />
              <SelectField
                name="groupBy"
                placeholder={t('Select Group By')}
                choices={metricGroupByOptions}
                value={metricQuery.groupBy}
                onChange={value => {
                  return handleFieldChange(queryIndex, 'groupBy')(value);
                }}
                style={{paddingRight: 0, paddingBottom: 0}}
                inline={false}
                allowClear={false}
                flexibleControlStateSize
                stacked
              />
              <SelectField
                name="aggregation"
                placeholder={t('Select Aggregation')}
                choices={Object.values(Aggregation).map(aggregation => [
                  aggregation,
                  aggregation,
                ])}
                value={metricQuery.aggregation}
                onChange={value => handleFieldChange(queryIndex, 'aggregation')(value)}
                style={{paddingRight: 0, paddingBottom: 0}}
                inline={false}
                allowClear={false}
                flexibleControlStateSize
                stacked
              />
              {queries.length > 1 && (
                <Button
                  size="zero"
                  borderless
                  onClick={event => {
                    event.preventDefault();
                    onRemoveQuery(queryIndex);
                  }}
                  icon={<IconDelete />}
                  title={t('Remove query')}
                  label={t('Remove query')}
                />
              )}
            </Fields>
          </Field>
        );
      })}
      <Button
        size="small"
        icon={<IconAdd isCircled />}
        onClick={(event: React.MouseEvent) => {
          event.preventDefault();
          onAddQuery();
        }}
      >
        {t('Add Query')}
      </Button>
    </div>
  );
}

export default Queries;

const Fields = styled('div')<{displayDeleteButton: boolean}>`
  display: grid;
  grid-template-columns: ${p =>
    p.displayDeleteButton ? '1fr 0.5fr 0.5fr max-content' : '1fr 0.5fr 0.5fr'};
  grid-gap: ${space(1)};
  align-items: center;
`;
