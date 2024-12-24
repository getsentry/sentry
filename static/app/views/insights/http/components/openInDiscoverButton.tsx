import * as qs from 'query-string';

import {LinkButton} from 'sentry/components/button';
import {t} from 'sentry/locale';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import type {EAPSpanProperty} from 'sentry/views/insights/types';

export function OpenInExploreButton({query}: {query: MutableSearch}) {
  const organization = useOrganization();

  const queryObj = {
    query: query.formatString(),
    groupBy: 'span.description' satisfies EAPSpanProperty,
    visualize: {
      chartType: 1,
      yAxes: ['avg(span.duration)', 'count(span.duration)'] satisfies EAPSpanProperty[],
    },
    mode: 'aggregate',
  };
  const url = normalizeUrl(
    `/organizations/${organization.slug}/traces/?${qs.stringify(queryObj)}`
  );

  return <LinkButton to={url}>{t('Go to Explore')}</LinkButton>;
}
