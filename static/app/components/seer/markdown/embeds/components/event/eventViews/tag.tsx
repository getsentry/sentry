import {useQuery} from '@tanstack/react-query';

import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {fetchIssueTagApiOptions} from 'sentry/actionCreators/group';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {EmbedSection} from 'sentry/components/seer/markdown/embeds/components/embedSection';
import {makeIssueTagDistributionPathname} from 'sentry/components/seer/markdown/embeds/components/event/eventPathnames';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {TagDistribution} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

/**
 * The schema deliberately puts no `.max()` on `tagKeys` -- an over-long list
 * would then fail to parse, and an embed whose props fail to parse renders
 * nothing at all. The cap lives here instead, so a runaway list degrades to the
 * first few distributions rather than to an empty card.
 */
const MAX_TAG_DISTRIBUTIONS = 4;

interface EventTagViewProps {
  /** Link to the issue's tag distributions page. Derived once by the block. */
  distributionsHref: string;
  issueId: string;
  organization: Organization;
  tagKeys: string[];
}

/**
 * One tag's distribution across the issue. Each key fetches on its own so a key
 * the issue has never been tagged with cannot blank out the ones beside it.
 */
function TagDistributionCard({
  issueId,
  organization,
  tagKey,
}: {
  issueId: string;
  organization: Organization;
  tagKey: string;
}) {
  const {
    data: tag,
    isPending,
    isError,
  } = useQuery(
    fetchIssueTagApiOptions<GroupTag>({organization, groupId: issueId, tagKey})
  );

  if (isPending) {
    return (
      <Flex justify="center" padding="md">
        <LoadingIndicator mini />
      </Flex>
    );
  }

  if (isError || !tag) {
    return <Text variant="muted">{t('Unable to load values for %s', tagKey)}</Text>;
  }

  return <TagDistribution tag={tag} />;
}

/**
 * How the requested tags are distributed across the whole issue the event
 * belongs to. `TagDistribution` is pure, so nothing here can reach the host
 * page's URL.
 */
export function EventTagView({
  issueId,
  organization,
  tagKeys,
  distributionsHref,
}: EventTagViewProps) {
  const visibleTagKeys = tagKeys.slice(0, MAX_TAG_DISTRIBUTIONS);
  // With one tag the header can point at that tag's own breakdown; with several
  // the only page covering all of them is the issue's distributions page.
  const singleTagKey = visibleTagKeys.length === 1 ? visibleTagKeys[0] : undefined;

  return (
    <EmbedSection
      title={t('Tag Distribution')}
      action={
        <ResourceLink
          icon={IconIssues}
          href={
            singleTagKey
              ? makeIssueTagDistributionPathname({
                  organizationSlug: organization.slug,
                  issueId,
                  tagKey: singleTagKey,
                })
              : distributionsHref
          }
          title={
            singleTagKey ? t('All %s values', singleTagKey) : t('All tags for this issue')
          }
        />
      }
    >
      {/*
        Bare keys are container queries, and the block sets `containerType`, so
        this pairs up on the embed's own width rather than the viewport's --
        the embed has no idea how wide the page around it is.
      */}
      <Grid
        columns={{zero: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))'}}
        gap="md"
        align="start"
      >
        {visibleTagKeys.map(tagKey => (
          <TagDistributionCard
            key={tagKey}
            issueId={issueId}
            organization={organization}
            tagKey={tagKey}
          />
        ))}
      </Grid>
    </EmbedSection>
  );
}
