import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import SearchBar from 'app/components/events/searchBar';
import {IconAdd, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import Field from 'app/views/settings/components/forms/field';
import SelectField from 'app/views/settings/components/forms/selectField';

import {Metric, MetricQuery} from './types';

type Props = {
  organization: Organization;
  projectId: Project['id'];
  metrics: Metric[];
  queries: MetricQuery[];
  onRemoveQuery: (index: number) => void;
  onAddQuery: () => void;
  onChangeQuery: (queryIndex: number, query: MetricQuery) => void;
  metric?: Metric;
};

function Queries({
  organization,
  projectId,
  metrics,
  queries,
  onRemoveQuery,
  onAddQuery,
  onChangeQuery,
  metric,
}: Props) {
  function handleFieldChange(queryIndex: number, field: keyof MetricQuery) {
    const widgetQuery = queries[queryIndex];
    return function handleChange(value: string) {
      const newQuery = {...widgetQuery, [field]: value};
      onChangeQuery(queryIndex, newQuery);
    };
  }

  const aggregations = metric
    ? metrics.find(m => m.name === metric.name)?.operations ?? []
    : [];

  return (
    <div>
      {queries.map((query, queryIndex) => {
        return (
          <StyledField key={queryIndex} inline={false} flexibleControlStateSize stacked>
            <Fields displayDeleteButton={queries.length > 1}>
              <SearchBar
                placeholder={t('Search for tag')}
                organization={organization}
                projectIds={[Number(projectId)]}
                query={query.tags}
                fields={[]}
                onChange={value => handleFieldChange(queryIndex, 'tags')(value)}
                onBlur={value => handleFieldChange(queryIndex, 'tags')(value)}
                useFormWrapper={false}
              />
              <StyledSelectField
                name="groupBy"
                placeholder={t('Select Group By')}
                choices={(metric?.tags ?? []).map(tag => [tag, tag])}
                value={query.groupBy}
                onChange={value => {
                  return handleFieldChange(queryIndex, 'groupBy')(value);
                }}
                inline={false}
                allowClear={false}
                flexibleControlStateSize
                stacked
              />
              <StyledSelectField
                name="aggregation"
                placeholder={t('Select Aggregation')}
                choices={aggregations.map(aggregation => [aggregation, aggregation])}
                value={query.aggregation}
                onChange={value => handleFieldChange(queryIndex, 'aggregation')(value)}
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
          </StyledField>
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

const StyledField = styled(Field)`
  padding-right: 0;
`;

const StyledSelectField = styled(SelectField)`
  padding-right: 0;
  padding-bottom: 0;
`;
