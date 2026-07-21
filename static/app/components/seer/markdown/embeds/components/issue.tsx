import styled from '@emotion/styled';

import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {GroupListHeader} from 'sentry/components/issues/groupListHeader';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {Placeholder} from 'sentry/components/placeholder';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {StreamGroup} from 'sentry/components/stream/group';
import {IconIssues} from 'sentry/icons';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

const BLOCK_COLUMNS: GroupListColumn[] = [
  'graph',
  'event',
  'users',
  'priority',
  'assignee',
];

function IssueBlock({groupId}: {groupId: string}) {
  const {data: group, isPending, isError} = useGroup({groupId});

  if (isError) {
    return null;
  }

  return (
    <Panel>
      <GroupListHeader withChart withColumns={BLOCK_COLUMNS} />
      <PanelBody>
        {isPending || !group ? (
          <PlaceholderRow height="66px" />
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

const PlaceholderRow = styled(Placeholder)`
  margin: ${p => p.theme.space.md};
  width: auto;
`;
