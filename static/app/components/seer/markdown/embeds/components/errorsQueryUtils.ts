import * as qs from 'query-string';

import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {EventView} from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';

export type ErrorsQueryKind = 'aggregate' | 'events';
export type ErrorsQueryData =
  | EmbedOutput<'errorsQuery'>
  | EmbedOutput<'errorsQueryAggregate'>;

const DEFAULT_EVENT_FIELDS = [
  'title',
  'event.type',
  'project',
  'user.display',
  'timestamp',
];
const DEFAULT_AGGREGATE_FIELDS = ['title', 'project', 'count()'];

export function buildErrorsEventView(data: ErrorsQueryData, kind: ErrorsQueryKind) {
  const {
    query,
    fields,
    yAxes,
    sort,
    title,
    projects,
    environments,
    statsPeriod,
    start,
    end,
  } = data;

  return EventView.fromSavedQuery({
    version: 2,
    name: title ?? t('Errors'),
    query,
    fields: fields?.length
      ? fields
      : kind === 'aggregate'
        ? DEFAULT_AGGREGATE_FIELDS
        : DEFAULT_EVENT_FIELDS,
    orderby: sort ?? (kind === 'aggregate' ? '-count' : '-timestamp'),
    projects: projects?.map(Number),
    environment: environments,
    range: statsPeriod,
    start,
    end,
    yAxis: yAxes,
    queryDataset: SavedQueryDatasets.ERRORS,
  });
}

export function getErrorsQueryHref(
  eventView: EventView,
  organization: Organization
): string {
  const target = eventView.getResultsViewUrlTarget(
    organization,
    false,
    SavedQueryDatasets.ERRORS
  );

  return `${target.pathname}?${qs.stringify(target.query, {skipNull: true})}`;
}
