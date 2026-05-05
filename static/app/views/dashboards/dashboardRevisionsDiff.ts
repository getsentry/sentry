import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {getRelativeSummary} from 'sentry/components/timeRangeSelector/utils';
import {t} from 'sentry/locale';
import {getFormattedDate} from 'sentry/utils/dates';

import type {DashboardDetails, Widget, WidgetQuery} from './types';
import {DashboardFilterKeys, DisplayType} from './types';

const DESCRIPTION_PREVIEW_MAX_LENGTH = 150;

type FieldChange = {after: string; before: string; field: string};

type FilterChange = {after: string; before: string; label: string};

function formatTime(d: DashboardDetails): string | null {
  if (d.period) return getRelativeSummary(d.period);
  if (d.start && d.end) {
    const fmt = (s: string) => getFormattedDate(s, 'MMM D, YYYY', {local: !d.utc});
    return `${fmt(d.start)} – ${fmt(d.end)}`;
  }
  return null;
}

function formatList(items: string[] | undefined): string {
  const filtered = items?.filter(Boolean) ?? [];
  return filtered.length ? filtered.join(', ') : t('(none)');
}

export function formatProjectIds(
  ids: number[] | undefined,
  resolveId: (id: number) => string | undefined
): string {
  if (!ids?.length) return t('My Projects');
  if (ids.includes(ALL_ACCESS_PROJECTS)) return t('All Projects');
  return ids.map(id => resolveId(id) ?? String(id)).join(', ');
}

export function diffFilters(
  base: DashboardDetails,
  snapshot: DashboardDetails,
  resolveProjectIds: (ids: number[] | undefined) => string
): FilterChange[] {
  const changes: FilterChange[] = [];

  if (base.title !== snapshot.title) {
    changes.push({label: t('Title'), before: base.title, after: snapshot.title});
  }

  const baseTime = formatTime(base);
  const snapshotTime = formatTime(snapshot);
  if (baseTime !== snapshotTime) {
    changes.push({
      label: t('Time range'),
      before: baseTime ?? t('(default)'),
      after: snapshotTime ?? t('(default)'),
    });
  }

  const baseProjects = resolveProjectIds(base.projects);
  const snapshotProjects = resolveProjectIds(snapshot.projects);
  if (baseProjects !== snapshotProjects) {
    changes.push({label: t('Projects'), before: baseProjects, after: snapshotProjects});
  }

  const baseEnv = formatList(base.environment);
  const snapshotEnv = formatList(snapshot.environment);
  if (baseEnv !== snapshotEnv) {
    changes.push({label: t('Environment'), before: baseEnv, after: snapshotEnv});
  }

  const baseReleases = formatList(base.filters?.[DashboardFilterKeys.RELEASE]);
  const snapshotReleases = formatList(snapshot.filters?.[DashboardFilterKeys.RELEASE]);
  if (baseReleases !== snapshotReleases) {
    changes.push({label: t('Releases'), before: baseReleases, after: snapshotReleases});
  }

  const baseGlobal =
    (base.filters?.[DashboardFilterKeys.GLOBAL_FILTER] ?? [])
      .map(f => f.value)
      .join(', ') || t('(none)');
  const snapshotGlobal =
    (snapshot.filters?.[DashboardFilterKeys.GLOBAL_FILTER] ?? [])
      .map(f => f.value)
      .join(', ') || t('(none)');
  if (baseGlobal !== snapshotGlobal) {
    changes.push({label: t('Global filters'), before: baseGlobal, after: snapshotGlobal});
  }

  return changes;
}

function truncateDescription(value: string): string {
  if (!value) return t('(empty)');
  if (value.length <= DESCRIPTION_PREVIEW_MAX_LENGTH) return value;
  return value.slice(0, DESCRIPTION_PREVIEW_MAX_LENGTH) + '…';
}

export type WidgetChange =
  | {status: 'added'; widget: Widget}
  | {status: 'removed'; widget: Widget}
  | {fields: FieldChange[]; layoutChanged: boolean; status: 'modified'; widget: Widget};

function diffQueryFields(
  base: WidgetQuery,
  snapshot: WidgetQuery,
  prefix: string
): FieldChange[] {
  const changes: FieldChange[] = [];

  if (base.conditions !== snapshot.conditions) {
    changes.push({
      field: `${prefix}filter`,
      before: base.conditions || t('(empty)'),
      after: snapshot.conditions || t('(empty)'),
    });
  }

  const baseAgg = base.aggregates.join(', ');
  const snapshotAgg = snapshot.aggregates.join(', ');
  if (baseAgg !== snapshotAgg) {
    changes.push({
      field: `${prefix}y-axis`,
      before: baseAgg || t('(none)'),
      after: snapshotAgg || t('(none)'),
    });
  }

  const baseCols = base.columns.join(', ');
  const snapshotCols = snapshot.columns.join(', ');
  if (baseCols !== snapshotCols) {
    changes.push({
      field: `${prefix}columns`,
      before: baseCols || t('(none)'),
      after: snapshotCols || t('(none)'),
    });
  }

  if (base.orderby !== snapshot.orderby) {
    changes.push({
      field: `${prefix}sort`,
      before: base.orderby || t('(none)'),
      after: snapshot.orderby || t('(none)'),
    });
  }

  if (base.name !== snapshot.name) {
    changes.push({
      field: `${prefix}series`,
      before: base.name || t('(empty)'),
      after: snapshot.name || t('(empty)'),
    });
  }

  return changes;
}

export function diffWidgets(
  base: DashboardDetails,
  snapshot: DashboardDetails
): WidgetChange[] {
  const changes: WidgetChange[] = [];

  const baseById = new Map<string, Widget>();
  const titleCounts = new Map<string, number>();
  for (const w of base.widgets) {
    if (w.id) baseById.set(w.id, w);
    titleCounts.set(w.title, (titleCounts.get(w.title) ?? 0) + 1);
  }
  // Only index titles that are unique — avoids wrong matches when two widgets share a title.
  // After a dashboard restore, widget IDs are reassigned, so title matching is the only way
  // to correlate widgets across the restore boundary.
  const baseByUniqueTitle = new Map<string, Widget>();
  for (const w of base.widgets) {
    if (titleCounts.get(w.title) === 1) {
      baseByUniqueTitle.set(w.title, w);
    }
  }

  const matchedBaseIndices = new Set<number>();

  for (const snapshotWidget of snapshot.widgets) {
    const matchById = snapshotWidget.id ? baseById.get(snapshotWidget.id) : undefined;
    const match = matchById ?? baseByUniqueTitle.get(snapshotWidget.title);
    const matchIndex = match ? base.widgets.indexOf(match) : -1;

    if (!match || matchIndex === -1 || matchedBaseIndices.has(matchIndex)) {
      changes.push({status: 'added', widget: snapshotWidget});
      continue;
    }

    matchedBaseIndices.add(matchIndex);

    const fields: FieldChange[] = [];

    if (match.title !== snapshotWidget.title) {
      fields.push({field: 'title', before: match.title, after: snapshotWidget.title});
    }
    if (match.displayType !== snapshotWidget.displayType) {
      fields.push({
        field: 'display type',
        before: match.displayType,
        after: snapshotWidget.displayType,
      });
    }
    if (match.interval !== snapshotWidget.interval) {
      fields.push({
        field: 'interval',
        before: match.interval,
        after: snapshotWidget.interval,
      });
    }

    const baseDescription = match.description || '';
    const snapshotDescription = snapshotWidget.description || '';
    if (baseDescription !== snapshotDescription) {
      const isTextWidget =
        match.displayType === DisplayType.TEXT ||
        snapshotWidget.displayType === DisplayType.TEXT;
      fields.push({
        field: isTextWidget ? t('content') : t('description'),
        before: truncateDescription(baseDescription),
        after: truncateDescription(snapshotDescription),
      });
    }

    const maxQueries = Math.max(match.queries.length, snapshotWidget.queries.length);
    for (let i = 0; i < maxQueries; i++) {
      const baseQuery = match.queries[i];
      const snapshotQuery = snapshotWidget.queries[i];
      const prefix = maxQueries > 1 ? `query ${i + 1} ` : '';

      if (!baseQuery || !snapshotQuery) {
        fields.push({
          field: `${prefix}query`,
          before: baseQuery ? t('present') : t('(none)'),
          after: snapshotQuery ? t('present') : t('(none)'),
        });
        continue;
      }

      fields.push(...diffQueryFields(baseQuery, snapshotQuery, prefix));
    }

    const layoutChanged =
      JSON.stringify(match.layout) !== JSON.stringify(snapshotWidget.layout);

    if (fields.length > 0 || layoutChanged) {
      changes.push({status: 'modified', widget: snapshotWidget, fields, layoutChanged});
    }
  }

  base.widgets.forEach((w, i) => {
    if (!matchedBaseIndices.has(i)) {
      changes.push({status: 'removed', widget: w});
    }
  });

  return changes;
}
