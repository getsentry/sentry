import type {Location} from 'history';

import type {Project} from 'sentry/types/project';
import {escapeDoubleQuotes} from 'sentry/utils';
import {defined} from 'sentry/utils/defined';
import type {Sort} from 'sentry/utils/discover/fields';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {parseConditionalAggregate} from 'sentry/views/explore/utils/conditionalAggregate';

export function generateTargetQuery({
  fields,
  groupBys,
  location,
  projects,
  search,
  row,
  sorts,
  yAxes,
}: {
  fields: readonly string[];
  groupBys: readonly string[];
  location: Location;
  // needed to generate targets when `project` is in the group by
  projects: Project[];
  row: Record<string, any>;
  search: MutableSearch;
  sorts: readonly Sort[];
  yAxes: string[];
}) {
  search = search.copy();

  // first update the resulting query to filter for the target group
  for (const groupBy of groupBys) {
    if (!groupBy) {
      continue;
    }
    const value = row[groupBy];
    // some fields require special handling so make sure to handle it here
    if (groupBy === 'project' && typeof value === 'string') {
      const project = projects.find(p => p.slug === value);
      if (defined(project)) {
        location.query.project = project.id;
      }
    } else if (groupBy === 'project.id' && typeof value === 'number') {
      location.query.project = String(value);
    } else if (groupBy === 'environment' && typeof value === 'string') {
      location.query.environment = value;
    } else if (typeof value === 'string') {
      // TODO(nsdeschenes): Remove this once we have a proper way to handle quoted values
      // that have square brackets included in the value
      if (value.startsWith('[') && value.endsWith(']')) {
        search.setFilterValues(groupBy, [`"${escapeDoubleQuotes(value)}"`]);
      } else {
        search.setFilterValues(groupBy, [value]);
      }
    } else if (typeof value === 'number') {
      search.setFilterValues(groupBy, [String(value)]);
    } else if (!defined(value)) {
      search.addFilterValue('!has', groupBy);
    }
  }

  const newFields = [...fields];
  const seenFields = new Set(newFields);

  // add all the arguments of the visualizations as columns
  for (const yAxis of yAxes) {
    // Parse conditionally so an `_if` filter query is not mistaken for an attribute and
    // added as a samples column.
    const parsedFunction = parseConditionalAggregate(yAxis);
    if (!parsedFunction?.arguments[0]) {
      continue;
    }
    const field = parsedFunction.arguments[0];
    if (seenFields.has(field)) {
      continue;
    }
    newFields.push(field);
    seenFields.add(field);
  }

  // fall back, force timestamp to be a column so we
  // always have at least 1 column
  if (newFields.length === 0) {
    newFields.push('timestamp');
    seenFields.add('timestamp');
  }

  // fall back, sort the last column present
  let sortBy: Sort = {
    field: newFields[newFields.length - 1]!,
    kind: 'desc' as const,
  };

  // find the first valid sort and sort on that
  for (const sort of sorts) {
    const parsedFunction = parseConditionalAggregate(sort.field);
    if (!parsedFunction?.arguments[0]) {
      continue;
    }
    const field = parsedFunction.arguments[0];

    // on the odd chance that this sorted column was not added
    // already, make sure to add it
    if (!seenFields.has(field)) {
      newFields.push(field);
    }

    sortBy = {
      field,
      kind: sort.kind,
    };
    break;
  }

  return {
    fields: newFields,
    search,
    sortBys: [sortBy],
  };
}
