import * as qs from 'query-string';

import {LinkButton} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {BASE_FILTERS} from 'sentry/views/insights/http/settings';

export function GoToExploreButton() {
  const organization = useOrganization();
  const filters = {...BASE_FILTERS};

  const queryObj = {
    query: MutableSearch.fromQueryObject(filters).formatString(),
    mode: 'aggregate',
  };
  const url = normalizeUrl(
    `/organizations/${organization.slug}/traces/${qs.stringify(queryObj)}`
  );

  return <LinkButton to={url}>{t('Go to Explore')}</LinkButton>;
}
