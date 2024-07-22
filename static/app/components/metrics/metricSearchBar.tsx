import {useCallback, useMemo} from 'react';
import {css} from '@emotion/react';
import {useId} from '@react-aria/utils';

import {QueryFieldGroup} from 'sentry/components/metrics/queryFieldGroup';
import type {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {t} from 'sentry/locale';
import {SavedSearchType, type TagCollection} from 'sentry/types/group';
import type {MRI} from 'sentry/types/metrics';
import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import {getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ensureQuotedTextFilters} from 'sentry/views/metrics/utils';
import {useSelectedProjects} from 'sentry/views/metrics/utils/useSelectedProjects';

export interface MetricSearchBarProps
  extends Partial<Omit<SmartSearchBarProps, 'projectIds'>> {
  onChange: (value: string) => void;
  blockedTags?: string[];
  disabled?: boolean;
  mri?: MRI;
  projectIds?: string[];
  query?: string;
}

const EMPTY_ARRAY = [];
const EMPTY_SET = new Set<never>();

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
  const selectedProjects = useSelectedProjects();
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

  const fetchTagValues = useCallback(
    (tagKey: string, search: string) => {
      return api.requestPromise(`/organizations/${org.slug}/metrics/tags/${tagKey}/`, {
        query: {
          prefix: search,
          metric: mri,
          useCase: getUseCaseFromMRI(mri),
          project: selection.projects,
        },
      });
    },
    [api, mri, org.slug, selection.projects]
  );

  const getTagValues = useCallback(
    async (tag: any, search: string) => {
      // The tag endpoint cannot provide values for the project tag
      if (tag.key === 'project') {
        return selectedProjects.map(project => project.slug);
      }

      const tagsValues = await fetchTagValues(tag.key, search);

      return tagsValues.filter(tv => tv.value !== '').map(tv => tv.value);
    },
    [fetchTagValues, selectedProjects]
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

  if (hasMetricsNewInputs(org)) {
    return (
      <QueryFieldGroup.SmartSearchBar
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
        css={wideSearchBarCss(disabled)}
      />
    );
  }

  return (
    <SmartSearchBar
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
      css={wideSearchBarCss(disabled)}
    />
  );
}

function wideSearchBarCss(disabled?: boolean) {
  return css`
    width: 100%;
    opacity: ${disabled ? '0.6' : '1'};
  `;
}
