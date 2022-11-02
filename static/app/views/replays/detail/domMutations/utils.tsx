import type {BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {Extraction} from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';

export const getDomMutationsTypes = (actions: Extraction[]) =>
  Array.from(
    new Set<BreadcrumbType>(actions.map(mutation => mutation.crumb.type))
  ).sort();
