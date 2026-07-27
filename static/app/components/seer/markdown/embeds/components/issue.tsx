import {useQuery} from '@tanstack/react-query';

import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {GroupListHeader} from 'sentry/components/issues/groupListHeader';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {Placeholder} from 'sentry/components/placeholder';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {StreamGroup} from 'sentry/components/stream/group';
import {IconIssues} from 'sentry/icons';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

const BLOCK_COLUMNS: GroupListColumn[] = [
  'graph',
  'event',
  'users',
  'priority',
  'assignee',
];

function IssueBlock({groupId}: {groupId: string}) {
  const organization = useOrganization();
  const {
    data: group,
    isPending,
    isError,
  } = useQuery(
    apiOptions.as<Group>()('/organizations/$organizationIdOrSlug/issues/$issueId/', {
      path: {organizationIdOrSlug: organization.slug, issueId: groupId},
      query: {
        expand: ['inbox', 'owners'],
        collapse: ['release', 'tags'],
      },
      staleTime: 30_000,
    })
  );

  if (isError) {
    return null;
  }

  return (
    <Panel>
      <GroupListHeader withChart withColumns={BLOCK_COLUMNS} />
      <PanelBody>
        {isPending || !group ? (
          <Placeholder height="66px" style={{margin: 'var(--space-md)', width: 'auto'}} />
        ) : (
          <StreamGroup
            group={group}
            withChart
            withColumns={BLOCK_COLUMNS}
            canSelect={false}
            useFilteredStats={false}
          />
        )}
      </PanelBody>
    </Panel>
  );
}

export const Issue = defineSeerEmbed({
  name: 'issue',
  render({groupId, shortId}, level) {
    if (level === 'block') {
      return <IssueBlock groupId={groupId} />;
    }
    return (
      <ResourceLink icon={IconIssues} href={`/issues/${groupId}/`} title={shortId} />
    );
  },
});
