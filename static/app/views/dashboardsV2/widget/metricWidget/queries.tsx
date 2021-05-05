import {Fragment} from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconAdd, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import Input from 'app/views/settings/components/forms/controls/input';

import GroupByField from './groupByField';
import MetricSelectField from './metricSelectField';
import {MetricMeta, MetricQuery} from './types';

type Props = {
  metricMetas: MetricMeta[];
  metricTags: string[];
  queries: MetricQuery[];
  onRemoveQuery: (index: number) => void;
  onAddQuery: () => void;
  onChangeQuery: (queryIndex: number, query: MetricQuery) => void;
};

function Queries({
  metricMetas,
  metricTags,
  queries,
  onRemoveQuery,
  onAddQuery,
  onChangeQuery,
}: Props) {
  function handleFieldChange(queryIndex: number, field: keyof MetricQuery) {
    const widgetQuery = queries[queryIndex];
    return function handleChange(value?: string | string[] | MetricMeta) {
      const newQuery = {...widgetQuery, [field]: value};
      onChangeQuery(queryIndex, newQuery);
    };
  }

  return (
    <Wrapper>
      {queries.map((query, queryIndex) => {
        return (
          <Fields displayDeleteButton={queries.length > 1} key={queryIndex}>
            <MetricSelectField
              metricMetas={metricMetas}
              metricMeta={query.metricMeta}
              aggregation={query.aggregation}
              onChange={(field, value) => handleFieldChange(queryIndex, field)(value)}
            />
            <GroupByField
              metricTags={metricTags}
              groupBy={query.groupBy}
              onChange={v => handleFieldChange(queryIndex, 'groupBy')(v)}
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
              <Fragment>
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
              </Fragment>
            )}
          </Fields>
        );
      })}
      <div>
        <Button size="small" icon={<IconAdd isCircled />} onClick={onAddQuery}>
          {t('Add query')}
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
      p.displayDeleteButton ? '1.3fr 1fr 0.5fr max-content' : '1.3fr 1fr 0.5fr'};
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

const ButtonDeleteWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    display: none;
  }
`;
