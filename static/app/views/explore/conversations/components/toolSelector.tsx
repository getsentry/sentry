import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import debounce from 'lodash/debounce';
import {parseAsArrayOf, parseAsString, useQueryStates} from 'nuqs';

import {CompactSelect, MenuComponents} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';
import {useWasSearchSpaceExhausted} from 'sentry/views/insights/common/utils/useWasSearchSpaceExhausted';
import {getToolSpansFilter} from 'sentry/views/insights/pages/agents/utils/query';
import {TableUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';
import {SpanFields} from 'sentry/views/insights/types';

const LIMIT = 100;
export const TOOL_URL_PARAM = 'tool';

const TOOL_NAME_FIELDS = [SpanFields.GEN_AI_TOOL_NAME] as const;

interface ToolSelectorProps {
  referrer: string;
  storageKeyPrefix: string;
}

export function ToolSelector({storageKeyPrefix, referrer}: ToolSelectorProps) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();

  const projectKey = [...pageFilters.selection.projects].sort().join(',');
  const storageKey = `${storageKeyPrefix}:${organization.slug}:${projectKey}`;

  const [storedTools, setStoredTools] = useLocalStorageState<string[]>(storageKey, []);

  const [{tool: urlTools}, setQueryStates] = useQueryStates(
    {
      [TOOL_URL_PARAM]: parseAsArrayOf(parseAsString),
      [TableUrlParams.CURSOR]: parseAsString,
    },
    {history: 'replace'}
  );

  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      if (!urlTools?.length && storedTools.length > 0) {
        setQueryStates({[TOOL_URL_PARAM]: storedTools});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevProjectKey = useRef(projectKey);
  useEffect(() => {
    if (prevProjectKey.current !== projectKey) {
      prevProjectKey.current = projectKey;
      setQueryStates({[TOOL_URL_PARAM]: null, [TableUrlParams.CURSOR]: null});
    }
  }, [projectKey, setQueryStates]);

  const selectedTools = useMemo(() => {
    if (prevProjectKey.current !== projectKey) {
      return [];
    }
    return urlTools ?? [];
  }, [urlTools, projectKey]);

  const [searchQuery, setSearchQuery] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetSearch = useCallback(
    debounce(newSearch => {
      setSearchQuery(newSearch);
    }, 500),
    []
  );

  const query = useMemo(() => {
    const parts = [getToolSpansFilter(), `has:${SpanFields.GEN_AI_TOOL_NAME}`];
    if (searchQuery) {
      parts.push(`${SpanFields.GEN_AI_TOOL_NAME}:*${searchQuery}*`);
    }
    return parts.join(' ');
  }, [searchQuery]);

  const {
    data: toolData,
    isPending,
    pageLinks,
  } = useSpans(
    {
      limit: LIMIT,
      search: query,
      sorts: [{field: 'count()', kind: 'desc'}],
      fields: [...TOOL_NAME_FIELDS, 'count()'],
    },
    referrer
  );

  const wasSearchSpaceExhausted = useWasSearchSpaceExhausted({
    query: searchQuery,
    isLoading: isPending,
    pageLinks,
  });

  const toolList = useMemo(() => {
    const uniqueTools = new Set<string>();
    const list: Array<{label: string; value: string}> = [];

    toolData?.forEach(row => {
      const toolName = row[SpanFields.GEN_AI_TOOL_NAME] as string | undefined;
      if (!toolName || uniqueTools.has(toolName)) {
        return;
      }
      uniqueTools.add(toolName);
      list.push({label: toolName, value: toolName});
    });

    selectedTools.forEach(tool => {
      if (tool && !uniqueTools.has(tool)) {
        list.push({label: tool, value: tool});
      }
    });

    return list;
  }, [toolData, selectedTools]);

  const cacheKey = [...pageFilters.selection.projects].sort().join(' ');
  const {options} = useCompactSelectOptionsCache(toolList, cacheKey);

  return (
    <CompactSelect
      multiple
      style={{maxWidth: '200px'}}
      value={selectedTools}
      options={options}
      emptyMessage={t('No tools found')}
      loading={isPending}
      search={{
        onChange: newValue => {
          if (!wasSearchSpaceExhausted) {
            debouncedSetSearch(newValue);
          }
        },
      }}
      menuTitle={t('Tools called')}
      menuHeaderTrailingItems={
        selectedTools.length > 0 ? (
          <MenuComponents.ResetButton
            onClick={() => {
              setStoredTools([]);
              setQueryStates({
                [TOOL_URL_PARAM]: null,
                [TableUrlParams.CURSOR]: null,
              });
            }}
          />
        ) : null
      }
      data-test-id="tool-selector"
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix={t('Tools called')}>
          {selectedTools.length ? triggerProps.children : t('All')}
        </OverlayTrigger.Button>
      )}
      onChange={newValue => {
        const values = newValue.map(v => v.value).filter(Boolean);
        setStoredTools(values);
        setQueryStates({
          [TOOL_URL_PARAM]: values.length > 0 ? values : null,
          [TableUrlParams.CURSOR]: null,
        });
      }}
    />
  );
}
