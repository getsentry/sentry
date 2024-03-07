import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import {useId} from '@react-aria/utils';
import memoize from 'lodash/memoize';

import type {SearchConfig} from 'sentry/components/searchSyntax/parser';
import {
  FilterType,
  joinQuery,
  parseSearch,
  Token,
} from 'sentry/components/searchSyntax/parser';
import {treeTransformer} from 'sentry/components/searchSyntax/utils';
import type {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {t} from 'sentry/locale';
import type {MRI, TagCollection} from 'sentry/types';
import {SavedSearchType} from 'sentry/types';
import {getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

interface MetricSearchBarProps extends Partial<SmartSearchBarProps> {
  onChange: (value: string) => void;
  blockedTags?: string[];
  disabled?: boolean;
  mri?: MRI;
  projectIds?: string[];
  query?: string;
}

const EMPTY_ARRAY = [];
const EMPTY_SET = new Set<never>();

export function ensureQuotedTextFilters(
  query: string,
  configOverrides?: Partial<SearchConfig>
) {
  const parsedSearch = parseSearch(query, configOverrides);

  if (!parsedSearch) {
    return query;
  }

  const newTree = treeTransformer({
    tree: parsedSearch,
    transform: token => {
      if (token.type === Token.FILTER && token.filter === FilterType.TEXT) {
        if (!token.value.quoted) {
          return {
            ...token,
            // joinQuery() does not access nested tokens, so we need to manipulate the text of the filter instead of it's value
            text: `${token.key.text}:"${token.value.text}"`,
          };
        }
      }
      return token;
    },
  });

  return joinQuery(newTree);
}

export function MetricSearchBar({
  mri,
  blockedTags,
  disabled,
  onChange,
  query,
  projectIds,
  id: idProp,
  ...props
}: MetricSearchBarProps) {
  const org = useOrganization();
  const api = useApi();
  const {selection} = usePageFilters();
  const id = useId(idProp);
  const projectIdNumbers = useMemo(
    () => projectIds?.map(projectId => parseInt(projectId, 10)),
    [projectIds]
  );

  const {data: tags = EMPTY_ARRAY, isLoading} = useMetricsTags(
    mri,
    {
      ...selection,
      projects: projectIdNumbers,
    },
    true,
    blockedTags
  );

  const supportedTags: TagCollection = useMemo(
    () => tags.reduce((acc, tag) => ({...acc, [tag.key]: tag}), {}),
    [tags]
  );

  const searchConfig = useMemo(
    () => ({
      booleanKeys: EMPTY_SET,
      dateKeys: EMPTY_SET,
      durationKeys: EMPTY_SET,
      numericKeys: EMPTY_SET,
      percentageKeys: EMPTY_SET,
      sizeKeys: EMPTY_SET,
      textOperatorKeys: EMPTY_SET,
      supportedTags,
      disallowFreeText: true,
    }),
    [supportedTags]
  );

  const fetchTagValues = useMemo(() => {
    const fn = memoize((tagKey: string) => {
      // clear response from cache after 10 seconds
      setTimeout(() => {
        fn.cache.delete(tagKey);
      }, 10000);
      return api.requestPromise(`/organizations/${org.slug}/metrics/tags/${tagKey}/`, {
        query: {
          metric: mri,
          useCase: getUseCaseFromMRI(mri),
          project: selection.projects,
        },
      });
    });
    return fn;
  }, [api, mri, org.slug, selection.projects]);

  const getTagValues = useCallback(
    async (tag: any, search: string) => {
      const tagsValues = await fetchTagValues(tag.key);

      return tagsValues
        .filter(
          tv =>
            tv.value !== '' &&
            tv.value.toLocaleLowerCase().includes(search.toLocaleLowerCase())
        )
        .map(tv => tv.value);
    },
    [fetchTagValues]
  );

  const handleChange = useCallback(
    (value: string, {validSearch} = {validSearch: true}) => {
      if (!validSearch) {
        return;
      }
      onChange(ensureQuotedTextFilters(value, searchConfig));
    },
    [onChange, searchConfig]
  );

  return (
    <WideSearchBar
      id={id}
      disabled={disabled}
      maxMenuHeight={220}
      organization={org}
      onGetTagValues={getTagValues}
      // don't highlight tags while loading as we don't know yet if they are supported
      highlightUnsupportedTags={!isLoading}
      onClose={handleChange}
      onSearch={handleChange}
      placeholder={t('Filter by tags')}
      query={query}
      savedSearchType={SavedSearchType.METRIC}
      {...searchConfig}
      {...props}
    />
  );
}

const WideSearchBar = styled(SmartSearchBar)`
  width: 100%;
  opacity: ${p => (p.disabled ? '0.6' : '1')};
`;
