import {joinQuery, parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import type {PageFilters} from 'sentry/types/core';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {IssueRowMetadata} from 'sentry/utils/dashboards/issueFieldRenderers';
import {getUtcDateString} from 'sentry/utils/dates';
import type {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {ISSUE_TABLE_FIELDS} from 'sentry/views/dashboards/widgetBuilder/issueWidget/fields';
import {DISCOVER_EXCLUSION_FIELDS} from 'sentry/views/issueList/utils';

export function transformIssuesResponseToTable(
  data: Group[],
  widgetQuery: WidgetQuery,
  _organization: Organization,
  pageFilters: PageFilters
): TableData {
  const issueRowMetadata: Record<string, IssueRowMetadata> = {};
  const transformedTableResults: TableDataRow[] = [];
  data.forEach(
    ({
      id,
      shortId,
      title,
      lifetime,
      filtered,
      count,
      userCount,
      project,
      annotations,
      assignedTo,
      owners,
      ...resultProps
    }) => {
      const transformedResultProps: Omit<TableDataRow, 'id'> = {};
      Object.keys(resultProps)
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        .filter(key => ['number', 'string'].includes(typeof resultProps[key]))
        .forEach(key => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          transformedResultProps[key] = resultProps[key];
        });

      issueRowMetadata[id] = {
        assignedTo,
        owners,
        links: annotations ?? [],
      };

      const transformedTableResult: TableDataRow = {
        ...transformedResultProps,
        events: count,
        users: userCount,
        id,
        'issue.id': id,
        issue: shortId,
        title,
        project: project.slug,
      };

      // Get lifetime stats
      if (lifetime) {
        transformedTableResult.lifetimeEvents = lifetime?.count;
        transformedTableResult.lifetimeUsers = lifetime?.userCount;
      }
      // Get filtered stats
      if (filtered) {
        transformedTableResult.filteredEvents = filtered?.count;
        transformedTableResult.filteredUsers = filtered?.userCount;
      }

      // Discover Url properties
      const query = widgetQuery.conditions;
      const parsedResult = parseSearch(query);
      const filteredTerms = parsedResult?.filter(
        p => !(p.type === Token.FILTER && DISCOVER_EXCLUSION_FIELDS.includes(p.key.text))
      );

      transformedTableResult.discoverSearchQuery = joinQuery(filteredTerms, true);
      transformedTableResult.projectId = project.id;

      const {period, start, end} = pageFilters.datetime || {};
      if (start && end) {
        transformedTableResult.start = getUtcDateString(start);
        transformedTableResult.end = getUtcDateString(end);
      }
      transformedTableResult.period = period ?? '';
      transformedTableResults.push(transformedTableResult);
    }
  );

  return {
    data: transformedTableResults,
    meta: {fields: ISSUE_TABLE_FIELDS, issueRowMetadata},
  };
}
