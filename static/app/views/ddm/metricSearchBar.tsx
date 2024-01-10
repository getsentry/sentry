import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import memoize from 'lodash/memoize';

import {BooleanOperator} from 'sentry/components/searchSyntax/parser';
import SmartSearchBar, {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {t} from 'sentry/locale';
import {MRI, SavedSearchType, TagCollection} from 'sentry/types';
import {getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

interface MetricSearchBarProps extends Partial<SmartSearchBarProps> {
  onChange: (value: string) => void;
  projectIds: string[];
  disabled?: boolean;
  mri?: MRI;
  query?: string;
}

const EMPTY_ARRAY = [];
const EMPTY_SET = new Set<never>();
const DISSALLOWED_LOGICAL_OPERATORS = new Set([BooleanOperator.OR]);

export function MetricSearchBar({
  mri,
  disabled,
  onChange,
  query,
  projectIds,
  ...props
}: MetricSearchBarProps) {
  const org = useOrganization();
  const api = useApi();
  const {selection} = usePageFilters();
  const projectIdNumbers = useMemo(
    () => projectIds.map(id => parseInt(id, 10)),
    [projectIds]
  );

  const {data: tags = EMPTY_ARRAY, isLoading} = useMetricsTags(mri, projectIdNumbers);

  const supportedTags: TagCollection = useMemo(
    () => tags.reduce((acc, tag) => ({...acc, [tag.key]: tag}), {}),
    [tags]
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
      if (validSearch) {
        onChange(value);
      }
    },
    [onChange]
  );

  return (
    <WideSearchBar
      disabled={disabled}
      maxMenuHeight={220}
      organization={org}
      onGetTagValues={getTagValues}
      supportedTags={supportedTags}
      // don't highlight tags while loading as we don't know yet if they are supported
      highlightUnsupportedTags={!isLoading}
      disallowedLogicalOperators={DISSALLOWED_LOGICAL_OPERATORS}
      disallowFreeText
      onClose={handleChange}
      onSearch={handleChange}
      placeholder={t('Filter by tags')}
      query={query}
      savedSearchType={SavedSearchType.METRIC}
      durationKeys={EMPTY_SET}
      percentageKeys={EMPTY_SET}
      numericKeys={EMPTY_SET}
      dateKeys={EMPTY_SET}
      booleanKeys={EMPTY_SET}
      sizeKeys={EMPTY_SET}
      textOperatorKeys={EMPTY_SET}
      {...props}
    />
  );
}

const WideSearchBar = styled(SmartSearchBar)`
  width: 100%;
  opacity: ${p => (p.disabled ? '0.6' : '1')};
`;
