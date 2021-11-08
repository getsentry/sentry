import {Fragment, useEffect} from 'react';

import {getUtcToLocalDateObject} from 'app/utils/dates';

import {QueryDefinitionWithKey, QueryHandlerProps, WidgetDataConstraint} from '../types';

/*
  Component to handle switching component-style queries over to state. This should be temporary to make it easier to switch away from waterfall style api components.
*/
export function QueryHandler<T extends WidgetDataConstraint>(
  props: QueryHandlerProps<T>
) {
  const children = props.children ?? <Fragment />;
  if (!props.queries.length) {
    return <Fragment>{children}</Fragment>;
  }

  const globalSelection = props.queryProps.eventView.getGlobalSelection();
  const start = globalSelection.datetime.start
    ? getUtcToLocalDateObject(globalSelection.datetime.start)
    : null;

  const end = globalSelection.datetime.end
    ? getUtcToLocalDateObject(globalSelection.datetime.end)
    : null;

  return (
    <Fragment>
      {props.queries
        .filter(q => (q.enabled ? q.enabled(props.widgetData) : true))
        .map(query => (
          <query.component
            key={query.queryKey}
            fields={query.fields}
            yAxis={query.fields}
            start={start}
            end={end}
            period={globalSelection.datetime.period}
            project={globalSelection.projects}
            environment={globalSelection.environments}
            organization={props.queryProps.organization}
            orgSlug={props.queryProps.organization.slug}
            query={props.queryProps.eventView.getQueryWithAdditionalConditions()}
            widgetData={props.widgetData}
          >
            {results => {
              return (
                <Fragment>
                  <QueryResultSaver<T> results={results} {...props} query={query} />
                </Fragment>
              );
            }}
          </query.component>
        ))}
    </Fragment>
  );
}

function QueryResultSaver<T extends WidgetDataConstraint>(
  props: {
    results: any; // TODO(k-fish): Fix this any.
    query: QueryDefinitionWithKey<T>;
  } & QueryHandlerProps<T>
) {
  const {results, query} = props;
  const transformed = query.transform(props.queryProps, results, props.query);

  useEffect(() => {
    props.setWidgetDataForKey(query.queryKey, transformed);
  }, [transformed?.hasData, transformed?.isLoading, transformed?.isErrored]);
  return <Fragment />;
}
