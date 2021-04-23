import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import Button from 'app/components/button';
import {IconAdd, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import Input from 'app/views/settings/components/forms/controls/input';
import SelectField from 'app/views/settings/components/forms/selectField';

import SearchBar from './searchBar';
import {Metric, MetricQuery} from './types';

type Props = {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  metrics: Metric[];
  queries: MetricQuery[];
  onRemoveQuery: (index: number) => void;
  onAddQuery: () => void;
  onChangeQuery: (queryIndex: number, query: MetricQuery) => void;
  metric?: Metric;
};

function Queries({
  api,
  orgSlug,
  projectSlug,
  metrics,
  queries,
  onRemoveQuery,
  onAddQuery,
  onChangeQuery,
  metric,
}: Props) {
  function handleFieldChange(queryIndex: number, field: keyof MetricQuery) {
    const widgetQuery = queries[queryIndex];
    return function handleChange(value: string | string[]) {
      const newQuery = {...widgetQuery, [field]: value};
      onChangeQuery(queryIndex, newQuery);
    };
  }

  const aggregations = metric
    ? metrics.find(m => m.name === metric.name)?.operations ?? []
    : [];

  return (
    <Wrapper>
      {queries.map((query, queryIndex) => {
        return (
          <Fields displayDeleteButton={queries.length > 1} key={queryIndex}>
            <SearchBar
              api={api}
              metricName={metric?.name ?? ''}
              tags={metric?.tags ?? []}
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              query={query.tags}
              onBlur={value => handleFieldChange(queryIndex, 'tags')(value)}
            />
            <StyledSelectField
              name="groupBy"
              placeholder={t('Select Group By')}
              choices={(metric?.tags ?? []).map(tag => [tag, tag])}
              value={query.groupBy[0]}
              onChange={value => {
                return handleFieldChange(queryIndex, 'groupBy')(value ? [value] : []);
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
            <Input
              type="text"
              name="legend"
              value={query.legend}
              placeholder={t('Legend Alias')}
              onChange={event =>
                handleFieldChange(queryIndex, 'legend')(event.target.value)
              }
              required
            />
            {queries.length > 1 && (
              <React.Fragment>
                <ButtonDeleteWrapper>
                  <Button
                    onClick={() => {
                      onRemoveQuery(queryIndex);
                    }}
                    size="small"
                  >
                    {t('Delete Query')}
                  </Button>
                </ButtonDeleteWrapper>
                <IconDeleteWrapper
                  onClick={() => {
                    onRemoveQuery(queryIndex);
                  }}
                >
                  <IconDelete aria-label={t('Delete Query')} />
                </IconDeleteWrapper>
              </React.Fragment>
            )}
          </Fields>
        );
      })}
      <div>
        <Button size="small" icon={<IconAdd isCircled />} onClick={onAddQuery}>
          {t('Add Query')}
        </Button>
      </div>
    </Wrapper>
  );
}

export default Queries;

const IconDeleteWrapper = styled('div')`
  height: 40px;
  cursor: pointer;
  display: none;

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    display: flex;
    align-items: center;
  }
`;

const Fields = styled('div')<{displayDeleteButton: boolean}>`
  display: grid;
  grid-gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: ${p =>
      p.displayDeleteButton
        ? '1fr 0.5fr 0.5fr 0.5fr max-content'
        : '1fr 0.5fr 0.5fr 0.5fr'};
    grid-gap: ${space(1)};
    align-items: center;
  }
`;

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints[3]}) {
    ${Fields} {
      :not(:first-child) {
        border-top: 1px solid ${p => p.theme.border};
        padding-top: ${space(2)};
      }
    }
  }
`;

const StyledSelectField = styled(SelectField)`
  padding-right: 0;
  padding-bottom: 0;
`;

const ButtonDeleteWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    display: none;
  }
`;
