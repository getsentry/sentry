import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {Extraction} from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';

import {getDomMutationsTypes} from './utils';

describe('getDomMutationsTypes', () => {
  const MUTATION_DEBUG = {crumb: {type: BreadcrumbType.DEBUG}} as Extraction;
  const MUTATION_UI = {crumb: {type: BreadcrumbType.UI}} as Extraction;

  it('should return a sorted list of BreadcrumbType', () => {
    const mutations = [MUTATION_DEBUG, MUTATION_UI];
    expect(getDomMutationsTypes(mutations)).toStrictEqual([
      BreadcrumbType.DEBUG,
      BreadcrumbType.UI,
    ]);
  });

  it('should deduplicate BreadcrumbType', () => {
    const mutations = [MUTATION_DEBUG, MUTATION_DEBUG];
    expect(getDomMutationsTypes(mutations)).toStrictEqual([BreadcrumbType.DEBUG]);
  });
});
