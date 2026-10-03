import {useMemo} from 'react';
import {useDebouncedValue} from '@tanstack/react-pacer';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {
  planPreview,
  seededShuffle,
  type ConventionFilters,
} from 'sentry/views/codeConventions/filterPreview';
import {
  getRepoFileUrls,
  repoFilesQueryOptions,
  type ConventionCommandKind,
} from 'sentry/views/codeConventions/utils';

const SAMPLE_SIZE = 15;
// Prefilter matches are rare (often under 1% of candidates), so files are read
// in pages, and the user decides whether to keep scanning.
const SCAN_PAGE_SIZE = 250;
const SCAN_CONCURRENCY = 16;

async function findMatches(paths: string[], regex: RegExp, signal: AbortSignal) {
  const matches: string[] = [];
  let next = 0;
  const worker = async () => {
    while (next < paths.length) {
      const path = paths[next++]!;
      const response = await fetch(getRepoFileUrls(path).rawUrl, {signal});
      if (response.ok && regex.test(await response.text())) {
        matches.push(path);
      }
    }
  };
  await Promise.all(Array.from({length: SCAN_CONCURRENCY}, worker));
  // Workers finish out of order; keep the sample order stable.
  return paths.filter(path => matches.includes(path));
}

function FileList({paths}: {paths: string[]}) {
  return (
    <Stack gap="xs">
      {paths.map(path => (
        <ExternalLink key={path} href={getRepoFileUrls(path).htmlUrl}>
          <Text size="sm" monospace>
            {path}
          </Text>
        </ExternalLink>
      ))}
    </Stack>
  );
}

interface Props {
  filters: ConventionFilters;
}

export function ConventionFilterPreview({filters}: Props) {
  const filesQuery = useQuery(repoFilesQueryOptions);
  const repoFiles = filesQuery.data;

  // Keyed on the serialized filters so a new object with the same values (from
  // re-parsing the YAML) doesn't recompute or restart the scan.
  const filtersKey = JSON.stringify(filters);
  const plan = useMemo(
    () => (repoFiles ? planPreview(repoFiles, JSON.parse(filtersKey)) : undefined),
    [repoFiles, filtersKey]
  );
  const sample = useMemo(
    () =>
      plan && plan.kind !== 'unsupported'
        ? seededShuffle(plan.candidates, filtersKey)
        : [],
    [plan, filtersKey]
  );

  // `plan` and `sample` derive from exactly the key's values, and a RegExp
  // can't be part of a query key.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const scanQuery = useInfiniteQuery({
    queryKey: ['convention-filter-preview', filtersKey, repoFiles?.length],
    queryFn: ({pageParam, signal}) =>
      plan?.kind === 'grep'
        ? findMatches(
            sample.slice(pageParam, pageParam + SCAN_PAGE_SIZE),
            plan.grep.regex,
            signal
          )
        : Promise.resolve([]),
    initialPageParam: 0,
    getNextPageParam: (_lastPage, _allPages, lastPageParam) =>
      lastPageParam + SCAN_PAGE_SIZE < sample.length
        ? lastPageParam + SCAN_PAGE_SIZE
        : undefined,
    enabled: plan?.kind === 'grep',
    staleTime: Infinity,
  });

  if (filesQuery.isPending) {
    return (
      <Flex gap="sm" align="center">
        <LoadingIndicator mini />
        <Text variant="muted">{t('Loading repository files…')}</Text>
      </Flex>
    );
  }
  if (filesQuery.isError || !plan) {
    return <LoadingError onRetry={filesQuery.refetch} />;
  }

  if (plan.kind === 'unsupported') {
    return <Text variant="muted">{plan.reason}</Text>;
  }

  if (plan.kind === 'glob') {
    return (
      <Stack gap="md">
        <Text>
          {t(
            '%s files match the include and exclude globs. A sample:',
            plan.candidates.length.toLocaleString()
          )}
        </Text>
        <FileList paths={sample.slice(0, SAMPLE_SIZE)} />
      </Stack>
    );
  }

  const pages = scanQuery.data?.pages ?? [];
  const matches = pages.flat();
  const scanned = Math.min(pages.length * SCAN_PAGE_SIZE, sample.length);

  return (
    <Stack gap="md">
      <Text>
        {t(
          '%s files are in the prefilter paths and match the globs.',
          plan.candidates.length.toLocaleString()
        )}{' '}
        {scanQuery.isPending
          ? t('Reading a sample of them…')
          : t(
              'Of %s read so far, %s match the prefilter pattern.',
              scanned.toLocaleString(),
              matches.length.toLocaleString()
            )}
      </Text>
      {scanQuery.isError && <LoadingError onRetry={scanQuery.refetch} />}
      {matches.length > 0 && <FileList paths={matches.slice(0, SAMPLE_SIZE)} />}
      {scanQuery.hasNextPage && (
        <Flex>
          <Button
            size="sm"
            busy={scanQuery.isFetching}
            disabled={scanQuery.isFetching}
            onClick={() => scanQuery.fetchNextPage()}
          >
            {t('Read %s more files', SCAN_PAGE_SIZE)}
          </Button>
        </Flex>
      )}
    </Stack>
  );
}

const COMMAND_DEBOUNCE_MS = 500;

interface CommandPreviewProps {
  command: string;
  kind: ConventionCommandKind;
  exclude?: string[];
  include?: string[];
}

/**
 * Previews a command as it's edited, waiting for a pause in typing so each
 * keystroke doesn't restart the scan. The convention's include/exclude globs
 * still apply to the command's output, as they do in the scanner.
 */
export function CommandPreview({command, kind, include, exclude}: CommandPreviewProps) {
  const [debouncedCommand] = useDebouncedValue(command, {wait: COMMAND_DEBOUNCE_MS});
  return (
    <ConventionFilterPreview filters={{include, exclude, [kind]: debouncedCommand}} />
  );
}
