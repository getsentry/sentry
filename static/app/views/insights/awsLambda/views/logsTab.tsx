import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {getFormattedDate} from 'sentry/utils/dates';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {SourceTag} from 'sentry/views/insights/awsLambda/components';
import {useUrlState} from 'sentry/views/insights/awsLambda/hooks';
import {
  invocations,
  type LambdaFunction,
  logsFor,
  type MockLog,
  type TimeWindow,
} from 'sentry/views/insights/awsLambda/mockData';

const MAX_LINES = 400;
type Level = 'all' | 'warn' | 'error';
type Source = 'all' | MockLog['source'];

export function LogsTab({fn, window}: {fn: LambdaFunction; window: TimeWindow}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useUrlState('lq');
  const [levelParam, setLevel] = useUrlState('level');
  const [sourceParam, setSource] = useUrlState('source');
  const [tail, setTail] = useState(false);
  const [tailed, setTailed] = useState<MockLog[]>([]);
  const level = (levelParam ?? 'all') as Level;
  const source = (sourceParam ?? 'all') as Source;

  const sampled = invocations(fn, window);
  const base = useMemo(
    () => sampled.slice(0, 90).flatMap(inv => logsFor(fn, inv)),
    [fn, sampled]
  );

  // Live tail: replay recent invocations as new lines.
  useEffect(() => {
    if (!tail) {
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      const inv = sampled[i % Math.max(1, sampled.length)];
      i++;
      if (!inv) {
        return;
      }
      const now = Date.now();
      const lines = logsFor(fn, {...inv, id: `${inv.id}-tail-${now}`, timestamp: now});
      setTailed(prev => [...lines, ...prev].slice(0, MAX_LINES));
    }, 1500);
    return () => clearInterval(id);
  }, [tail, fn, sampled]);

  const lines = useMemo(() => {
    const q = (search ?? '').toLowerCase();
    return [...tailed, ...base]
      .filter(line =>
        level === 'all'
          ? true
          : level === 'warn'
            ? line.level !== 'info'
            : line.level === 'error'
      )
      .filter(line => source === 'all' || line.source === source)
      .filter(
        line => !q || line.message.toLowerCase().includes(q) || line.requestId.includes(q)
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_LINES);
  }, [tailed, base, level, source, search]);

  const openInvocation = (line: MockLog) => {
    navigate({
      ...location,
      query: {
        ...location.query,
        tab: 'invocations',
        invocation: line.invocationId.replace(/-tail-\d+$/, ''),
      },
    });
  };

  return (
    <Stack gap="md" paddingTop="lg">
      <Flex gap="sm" align="center" wrap="wrap">
        <SearchInput
          size="sm"
          placeholder={t('Search messages or a request ID')}
          defaultValue={search ?? ''}
          onChange={event => setSearch(event.target.value)}
        />
        <SegmentedControl<Level>
          size="xs"
          aria-label={t('Level')}
          value={level}
          onChange={value => setLevel(value === 'all' ? undefined : value)}
        >
          <SegmentedControl.Item key="all">{t('All levels')}</SegmentedControl.Item>
          <SegmentedControl.Item key="warn">{t('Warnings+')}</SegmentedControl.Item>
          <SegmentedControl.Item key="error">{t('Errors')}</SegmentedControl.Item>
        </SegmentedControl>
        <SegmentedControl<Source>
          size="xs"
          aria-label={t('Source')}
          value={source}
          onChange={value => setSource(value === 'all' ? undefined : value)}
        >
          <SegmentedControl.Item key="all">{t('All sources')}</SegmentedControl.Item>
          <SegmentedControl.Item key="platform">{t('Platform')}</SegmentedControl.Item>
          <SegmentedControl.Item key="stdout">{t('stdout')}</SegmentedControl.Item>
          <SegmentedControl.Item key="logging">
            {t('logging (SDK)')}
          </SegmentedControl.Item>
        </SegmentedControl>
        <Flex as="label" gap="xs" align="center">
          <Switch size="sm" checked={tail} onChange={() => setTail(!tail)} />
          <Text size="sm">{tail ? t('Tailing…') : t('Live tail')}</Text>
        </Flex>
        <SourceTag source="logs" />
      </Flex>
      <Text size="xs" variant="muted">
        {t(
          'Function output from the Telemetry API (no CloudWatch needed) merged with SDK logging records. Click a line to open its invocation.'
        )}
      </Text>
      <Container border="primary" radius="md" overflow="hidden">
        {lines.length ? (
          lines.map(line => (
            <LogRow
              key={line.id}
              level={line.level}
              onClick={() => openInvocation(line)}
              fresh={line.id.includes('-tail-')}
            >
              <Text size="xs" monospace variant="muted" tabular>
                {getFormattedDate(line.timestamp, 'MMM D HH:mm:ss.SSS')}
              </Text>
              <Tag variant={line.source === 'logging' ? 'info' : 'muted'}>
                {line.source}
              </Tag>
              <Text
                size="xs"
                monospace
                wordBreak="break-all"
                variant={
                  line.level === 'error'
                    ? 'danger'
                    : line.level === 'warn'
                      ? 'warning'
                      : undefined
                }
              >
                <Highlight text={line.message} query={search ?? ''} />
              </Text>
              <Text size="xs" monospace variant="muted" ellipsis>
                {line.requestId.slice(0, 8)}
              </Text>
            </LogRow>
          ))
        ) : (
          <Container padding="xl">
            <Text variant="muted">{t('No log lines match.')}</Text>
          </Container>
        )}
      </Container>
    </Stack>
  );
}

function Highlight({text, query}: {query: string; text: string}) {
  if (!query) {
    return <Fragment>{text}</Fragment>;
  }
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) {
    return <Fragment>{text}</Fragment>;
  }
  return (
    <Fragment>
      {text.slice(0, index)}
      <Mark>{text.slice(index, index + query.length)}</Mark>
      {text.slice(index + query.length)}
    </Fragment>
  );
}

const SearchInput = styled(Input)`
  max-width: 320px;
`;

const Mark = styled('mark')`
  background: ${p => p.theme.tokens.graphics.warning.vibrant};
  color: inherit;
  padding: 0 1px;
  border-radius: 2px;
`;

const LogRow = styled('div')<{fresh: boolean; level: MockLog['level']}>`
  display: grid;
  grid-template-columns: 150px max-content minmax(0, 1fr) 70px;
  gap: ${p => p.theme.space.md};
  align-items: center;
  padding: 3px ${p => p.theme.space.lg};
  cursor: pointer;
  border-left: 3px solid
    ${p =>
      p.level === 'error'
        ? p.theme.tokens.graphics.danger.vibrant
        : p.level === 'warn'
          ? p.theme.tokens.graphics.warning.vibrant
          : 'transparent'};
  background: ${p => (p.fresh ? p.theme.tokens.background.secondary : 'transparent')};

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;
