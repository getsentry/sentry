import {useQuery} from '@tanstack/react-query';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {fetchIssueTagApiOptions} from 'sentry/actionCreators/group';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {TagDistribution} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

interface EventTagViewProps {
  issueId: string;
  organization: Organization;
  /** Link to this tag's breakdown page. Derived once by the block. */
  tagHref: string;
  tagKey: string;
}

/**
 * How one tag is distributed across the whole issue the event belongs to.
 * `TagDistribution` is pure, so nothing here can reach the host page's URL.
 */
export function EventTagView({
  issueId,
  organization,
  tagKey,
  tagHref,
}: EventTagViewProps) {
  const {
    data: tag,
    isPending,
    isError,
  } = useQuery(
    fetchIssueTagApiOptions<GroupTag>({organization, groupId: issueId, tagKey})
  );

  return (
    <Stack gap="md">
      <Flex align="center" gap="md" justify="between" wrap="wrap">
        <Text bold size="xs" uppercase variant="muted">
          {t('Tag Distribution')}
        </Text>
        <ResourceLink
          icon={IconIssues}
          href={tagHref}
          title={t('All %s values', tagKey)}
        />
      </Flex>
      {isPending ? (
        <Flex justify="center" padding="md">
          <LoadingIndicator mini />
        </Flex>
      ) : isError || !tag ? (
        <Text variant="muted">{t('Unable to load values for %s', tagKey)}</Text>
      ) : (
        <TagDistribution tag={tag} />
      )}
    </Stack>
  );
}
