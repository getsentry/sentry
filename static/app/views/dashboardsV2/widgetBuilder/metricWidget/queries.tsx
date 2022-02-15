import {Fragment} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Input from 'sentry/components/forms/controls/input';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {MetricMeta, MetricQuery} from 'sentry/types';

import MetricSelectField from './metricSelectField';

type Props = {
  metricMetas: MetricMeta[];
  onAddQuery: () => void;
  onChangeQuery: (queryIndex: number, query: MetricQuery) => void;
  onRemoveQuery: (index: number) => void;
  queries: MetricQuery[];
};

function Queries({
  metricMetas,
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
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: ${p =>
      p.displayDeleteButton ? '1fr 33% max-content' : '1fr 33%'};
    gap: ${space(1)};
    align-items: center;
  }
`;

const Wrapper = styled('div')`
  display: grid;
  gap: ${space(2)};
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
