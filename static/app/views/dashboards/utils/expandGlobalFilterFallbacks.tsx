import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {GlobalFilterFallback} from 'sentry/views/dashboards/types';

function filterFor(attribute: string, values: string[]): string {
  return new MutableSearch('').addFilterValueList(attribute, values).formatString();
}

/**
 * Widens global filters whose attribute is missing from the rows a widget
 * aggregates, using the fallback attributes the widget query declares.
 *
 * With a `screen` -> `transaction` fallback, `os.name:Android screen:Main`
 * becomes `os.name:Android (screen:Main OR transaction:Main)`. The filtered
 * attribute is replaced in place so the remaining filters still apply to both
 * sides of the OR.
 *
 * Negated and `has:` filters are left alone; only a positive value filter can be
 * widened to another attribute.
 */
export function expandGlobalFilterFallbacks(
  filterConditions: string,
  fallbacks: GlobalFilterFallback[] | undefined
): string {
  if (!filterConditions || !fallbacks?.length) {
    return filterConditions;
  }

  const remaining = new MutableSearch(filterConditions);
  const expanded: string[] = [];

  for (const {attribute, fallbackAttribute} of fallbacks) {
    // getFilterValues() normalizes away negation, so an excluded attribute would
    // otherwise come back as an inclusive OR branch. `has:` forms are already
    // skipped because they tokenize under a `has` key rather than the attribute.
    if (filterConditions.includes(`!${attribute}:`)) {
      continue;
    }

    const values = remaining.getFilterValues(attribute);
    if (values.length === 0) {
      continue;
    }

    remaining.removeFilter(attribute);
    expanded.push(
      `(${filterFor(attribute, values)} OR ${filterFor(fallbackAttribute, values)})`
    );
  }

  if (expanded.length === 0) {
    return filterConditions;
  }

  return [remaining.formatString(), ...expanded].filter(Boolean).join(' ');
}
