import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Input from 'sentry/components/input';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DisplayType} from 'sentry/views/dashboards/types';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

function WidgetBuilderQueryFilterBuilder() {
  const {state, dispatch} = useWidgetBuilderContext();

  const canAddSearchConditions =
    state.displayType !== DisplayType.TABLE &&
    state.displayType !== DisplayType.BIG_NUMBER;

  const onAddSearchConditions = () => {
    // TODO: after hook gets updated with different dispatch types, change this part
    dispatch({
      type: BuilderStateAction.SET_QUERY,
      payload: state.query?.length ? [...state.query, ''] : ['', ''],
    });
  };

  return (
    <Fragment>
      <SectionHeader
        title={t('Filter')}
        tooltipText={
          canAddSearchConditions
            ? t(
                'Filter down your search here. You can add multiple queries to compare data for each overlay'
              )
            : t('Filter down your search here')
        }
        optional
      />
      {!state.query?.length ? (
        <QueryFieldRowWrapper key={0}>
          <QueryField
            query={''}
            onSearch={queryString => {
              dispatch({
                type: BuilderStateAction.SET_QUERY,
                payload: [queryString],
              });
            }}
          />
          {canAddSearchConditions && (
            // TODO: Hook up alias to query hook when it's implemented
            <LegendAliasInput
              type="text"
              name="name"
              placeholder={t('Legend Alias')}
              onChange={() => {}}
            />
          )}
        </QueryFieldRowWrapper>
      ) : (
        state.query?.map((query, index) => (
          <QueryFieldRowWrapper key={index}>
            <QueryField
              query={query}
              onSearch={queryString => {
                dispatch({
                  type: BuilderStateAction.SET_QUERY,
                  payload:
                    state.query?.map((q, i) => (i === index ? queryString : q)) ?? [],
                });
              }}
            />
            {canAddSearchConditions && (
              // TODO: Hook up alias to query hook when it's implemented
              <LegendAliasInput
                type="text"
                name="name"
                placeholder={t('Legend Alias')}
                onChange={() => {}}
              />
            )}
            {state.query && state.query?.length > 1 && canAddSearchConditions && (
              <DeleteButton
                onDelete={() =>
                  dispatch({
                    type: BuilderStateAction.SET_QUERY,
                    payload: state.query?.filter((_, i) => i !== index) ?? [],
                  })
                }
              />
            )}
          </QueryFieldRowWrapper>
        ))
      )}
      {canAddSearchConditions && (
        <Button size="sm" icon={<IconAdd isCircled />} onClick={onAddSearchConditions}>
          {t('Add Filter')}
        </Button>
      )}
    </Fragment>
  );
}

export default WidgetBuilderQueryFilterBuilder;

function QueryField({
  query,
  onSearch,
}: {
  onSearch: (query: string) => void;
  query: string;
}) {
  return (
    <SearchQueryBuilder
      placeholder={t('Search')}
      filterKeys={{}}
      initialQuery={query ?? ''}
      onSearch={onSearch}
      searchSource={'widget_builder'}
      filterKeySections={[]}
      getTagValues={() => Promise.resolve([])}
      showUnsubmittedIndicator
    />
  );
}

export function DeleteButton({onDelete}: {onDelete: () => void}) {
  return (
    <Button
      size="zero"
      style={{height: 'fit-content'}}
      borderless
      onClick={onDelete}
      icon={<IconDelete />}
      title={t('Remove this filter')}
      aria-label={t('Remove this filter')}
      name="filter-delete-button"
    />
  );
}

const QueryFieldRowWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  margin-bottom: ${space(1)};
  align-items: center;
`;

const LegendAliasInput = styled(Input)`
  width: 33%;
`;
