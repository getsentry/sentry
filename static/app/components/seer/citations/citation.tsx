import {createElement, type ComponentType} from 'react';
import {IconCode} from '@sentry/icons/code';
import {IconCommit} from '@sentry/icons/commit';
import {IconFire} from '@sentry/icons/fire';
import {IconIssues} from '@sentry/icons/issues';
import {IconLink} from '@sentry/icons/link';
import {IconList} from '@sentry/icons/list';
import {IconMegaphone} from '@sentry/icons/megaphone';
import {IconPlay} from '@sentry/icons/play';
import {IconProfiling} from '@sentry/icons/profiling';
import {IconPullRequest} from '@sentry/icons/pullRequest';
import {IconSearch} from '@sentry/icons/search';
import {IconSpan} from '@sentry/icons/span';
import type {SVGIconProps} from '@sentry/icons/svgIcon';

import {Button, LinkButton} from '@sentry/scraps/button';
import {DateTime} from '@sentry/scraps/dateTime';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SeerEmbedRegistry} from 'sentry/components/seer/markdown/embeds';
import {t} from 'sentry/locale';

import {citationToEmbed, describeCitationLocation} from './citationEmbed';
import type {Citation, CitationKind} from './schemas';

const KIND_ICONS: Record<CitationKind, ComponentType<SVGIconProps>> = {
  issue: IconIssues,
  event: IconFire,
  trace: IconSpan,
  log: IconList,
  replay: IconPlay,
  profile: IconProfiling,
  query: IconSearch,
  feedback: IconMegaphone,
  code: IconCode,
  commit: IconCommit,
  pullRequest: IconPullRequest,
  external: IconLink,
};

function citationKindLabel(kind: CitationKind): string {
  switch (kind) {
    case 'issue':
      return t('Issue');
    case 'event':
      return t('Event');
    case 'trace':
      return t('Trace');
    case 'log':
      return t('Log');
    case 'replay':
      return t('Replay');
    case 'profile':
      return t('Profile');
    case 'query':
      return t('Query');
    case 'feedback':
      return t('Feedback');
    case 'code':
      return t('Code');
    case 'commit':
      return t('Commit');
    case 'pullRequest':
      return t('Pull request');
    case 'external':
      return t('Link');
    default:
      return kind;
  }
}

interface CitationChipProps {
  citation: Citation;
  expanded: boolean;
  onToggle: () => void;
}

/** Compact, clickable reference to one citation. Expands its detail when pressed. */
export function CitationChip({citation, expanded, onToggle}: CitationChipProps) {
  const Icon = KIND_ICONS[citation.kind];
  return (
    <Button
      size="xs"
      variant={expanded ? 'primary' : 'secondary'}
      icon={<Icon />}
      onClick={onToggle}
      aria-expanded={expanded}
      tooltipProps={{
        title: citation.excerpt ?? describeCitationLocation(citation) ?? citation.title,
      }}
    >
      <Container maxWidth="200px" overflow="hidden">
        <Text ellipsis size="xs">
          {citation.title}
        </Text>
      </Container>
    </Button>
  );
}

/**
 * Everything a citation says about its datum: what it is, the exact excerpt
 * the claim relied on, and the datum itself rendered the way Seer renders it
 * everywhere else (falling back to a link for sources Sentry can't render).
 */
export function CitationDetail({citation}: {citation: Citation}) {
  const Icon = KIND_ICONS[citation.kind];
  const location = describeCitationLocation(citation);
  const embed = citationToEmbed(citation);
  const Embed = embed ? SeerEmbedRegistry.get(embed.name) : undefined;

  return (
    <Stack
      gap="sm"
      padding="sm md"
      border="muted"
      radius="md"
      data-test-id={`citation-detail-${citation.id}`}
    >
      <Flex gap="sm" align="center" wrap="wrap">
        <Icon size="xs" />
        <Text size="xs" variant="muted" uppercase>
          {citationKindLabel(citation.kind)}
        </Text>
        <Text size="sm" bold>
          {citation.title}
        </Text>
        {location && !isRedundant(location, citation.title) && (
          <Text size="sm" variant="muted">
            {location}
          </Text>
        )}
        {citation.observedAt && (
          <Text size="xs" variant="muted">
            <DateTime date={citation.observedAt} />
          </Text>
        )}
      </Flex>
      {citation.excerpt && (
        <Container padding="xs sm" background="secondary" radius="sm">
          <Text as="p" size="sm" monospace wrap="pre-wrap">
            {citation.excerpt}
          </Text>
        </Container>
      )}
      {Embed && embed ? (
        // A registered embed is a stable, module-level component.
        createElement(Embed, {name: embed.name, data: embed.data, level: 'block'})
      ) : citation.url ? (
        <Flex>
          <LinkButton size="xs" href={citation.url} external icon={<IconLink />}>
            {t('Open %s', citationKindLabel(citation.kind).toLowerCase())}
          </LinkButton>
        </Flex>
      ) : null}
    </Stack>
  );
}

/** A frame's or tag's location usually restates its title; skip it then. */
function isRedundant(location: string, title: string): boolean {
  const words = location.split(/[^\w./-]+/).filter(Boolean);
  return words.every(word => title.includes(word));
}
