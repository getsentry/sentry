import {Fragment, useMemo, useState} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import * as Storybook from 'sentry/stories';
import {ImpactClaims} from 'sentry/views/issueDetails/activitySection/activityLineItem/impact';

import {EXAMPLE_CITATIONS} from './__fixtures__/examples';
import {useStoryCitations} from './__stories__/useStoryCitations';
import {CitationChip, CitationDetail, citationKindLabel} from './citation';
import {CITATION_KINDS, type Citation} from './schemas';

function KindSection({
  kind,
  citations,
  source,
}: {
  citations: Citation[];
  kind: (typeof CITATION_KINDS)[number];
  source: ReturnType<typeof useStoryCitations>['sources'][typeof kind];
}) {
  const label = citationKindLabel(kind);
  const example = EXAMPLE_CITATIONS.find(c => c.kind === kind);
  return (
    <Stack gap="sm" data-test-id={`citation-kind-${kind}`}>
      <Text size="xs" bold uppercase variant="muted">
        {label}
        {source === 'example' && ' (static example)'}
      </Text>
      {source === 'loading' ? (
        <LoadingIndicator mini />
      ) : source === 'missing' ? (
        <Fragment>
          <Text size="sm" variant="muted">
            No {label.toLowerCase()} in this organization, so only its chip can be
            previewed.
          </Text>
          {example && (
            <Flex>
              <CitationChip citation={example} expanded={false} onToggle={() => {}} />
            </Flex>
          )}
        </Fragment>
      ) : (
        citations.map(citation => (
          <Stack key={citation.id} gap="xs">
            <Flex>
              <CitationChip citation={citation} expanded onToggle={() => {}} />
            </Flex>
            <CitationDetail citation={citation} />
          </Stack>
        ))
      )}
    </Stack>
  );
}

function AllKinds() {
  const {citations, sources} = useStoryCitations();
  return (
    <Stack gap="xl">
      <Text as="p">
        One section per citation kind. Kinds that render a Sentry view (issue, event,
        trace, log, replay, profile, query) use real data from this organization, the way
        the Seer embed stories do. The rest render from the citation alone.
      </Text>
      {CITATION_KINDS.map(kind => (
        <KindSection
          key={kind}
          kind={kind}
          source={sources[kind]}
          citations={citations.filter(c => c.kind === kind)}
        />
      ))}
    </Stack>
  );
}

function Chips() {
  const {citations} = useStoryCitations();
  const [expanded, setExpanded] = useState<string | null>(null);
  const current = citations.find(c => c.id === expanded);
  return (
    <Stack gap="md">
      <Text as="p">
        Every citation this organization can show. Press a chip to expand it.
      </Text>
      <Flex gap="sm" wrap="wrap">
        {citations.map(citation => (
          <CitationChip
            key={citation.id}
            citation={citation}
            expanded={expanded === citation.id}
            onToggle={() => setExpanded(expanded === citation.id ? null : citation.id)}
          />
        ))}
      </Flex>
      {current && <CitationDetail citation={current} />}
    </Stack>
  );
}

function InImpactAssessment() {
  const {citations} = useStoryCitations();
  const citationsById = useMemo(
    () => new Map(citations.map(citation => [citation.id, citation])),
    [citations]
  );
  const ids = (...wanted: string[]) => wanted.filter(id => citationsById.has(id));
  const claims = [
    {
      claim: 'The crash happens before the order request is sent.',
      citationIds: ids('c_liveframe', 'c_code01'),
    },
    {
      claim: 'Real shoppers hit it, on the checkout page.',
      citationIds: ids('c_liveuser', 'c_livetag', 'c_livereplay'),
    },
    {claim: 'It is widespread.', citationIds: ids('c_liveusers', 'c_livequery')},
    {
      claim: 'The payment provider times out on the same trace.',
      citationIds: ids('c_livelog', 'c_livetrace'),
    },
    {
      claim: 'It started with a recent refactor.',
      citationIds: ids('c_commit01', 'c_pr01'),
    },
  ].filter(claim => claim.citationIds.length);

  return (
    <Stack gap="md">
      <Text as="p">
        Claims as the Impact activity lists them, citing this organization's data.
      </Text>
      <ImpactClaims claims={claims} citationsById={citationsById} />
    </Stack>
  );
}

export default Storybook.story('Citations', story => {
  story('All kinds', () => <AllKinds />);
  story('Chips', () => <Chips />);
  story('In an Impact assessment', () => <InImpactAssessment />);
});
