import styled from '@emotion/styled';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {SEMVER_TAGS} from 'sentry/utils/discover/fields';
import {FieldKey} from 'sentry/utils/fields';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export default function ReleaseTableSearch() {
  const location = useLocation();
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});
  const navigate = useNavigate();
  const {
    selection: {environments},
  } = usePageFilters();
  const disableStageSearch = environments.length !== 1;

  const filterKeys = [
    ...Object.values(SEMVER_TAGS).filter(
      tag => !(disableStageSearch && tag.key === FieldKey.RELEASE_STAGE)
    ),
    {
      key: 'release',
      name: 'release',
    },
  ].reduce((acc, tag) => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    acc[tag.key] = tag;
    return acc;
  }, {});

  const getQuery = () => {
    const {query} = location.query;
    return typeof query === 'string' ? query : undefined;
  };

  const tagValueLoader = (key: string, search: string) => {
    return fetchTagValues({
      api,
      orgSlug: organization.slug,
      tagKey: key,
      search,
      endpointParams: normalizeDateTimeParams(location.query),
    });
  };

  const handleSearch = (query: string) => {
    navigate({
      ...location,
      query: {...location.query, cursor: undefined, query},
    });
  };

  const getTagValues: GetTagValues = async (tag, currentQuery) => {
    const values = await tagValueLoader(tag.key, currentQuery);
    return values.map(({value}) => value);
  };

  return (
    <StyledSearchQueryBuilder
      onSearch={handleSearch}
      initialQuery={getQuery() || ''}
      filterKeys={filterKeys}
      getTagValues={getTagValues}
      placeholder={t('Search by version, build, package, or stage')}
      searchSource="releases"
    />
  );
}

const StyledSearchQueryBuilder = styled(SearchQueryBuilder)`
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    grid-column: 1 / -1;
  }
`;
