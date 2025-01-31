import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Flex} from 'sentry/components/container/flex';
import ShortId from 'sentry/components/group/inboxBadges/shortId';
import Link from 'sentry/components/links/link';
import TimeSince from 'sentry/components/timeSince';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';

export type IssueCellProps = {
  disabled?: boolean;
  group?: Group;
};

export function IssueCell({group, disabled = false}: IssueCellProps) {
  if (!group) {
    return <EmptyCell />;
  }
  return (
    <IssueWrapper to={'/issues/' + group.id} disabled={disabled}>
      <ShortId
        shortId={group.shortId}
        avatar={<ProjectAvatar project={group.project} />}
      />

      <LastSeenWrapper gap={space(0.5)}>
        {t('Last seen')}
        <TimeSince
          date={group.lastSeen}
          liveUpdateInterval={'second'}
          unitStyle="short"
          disabledAbsoluteTooltip
        />
      </LastSeenWrapper>
    </IssueWrapper>
  );
}

const IssueWrapper = styled(Link)<{disabled: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.textColor)};
  font-size: ${p => p.theme.fontSizeMedium};

  ${p =>
    !p.disabled &&
    `
    &:hover {
      color: ${p.theme.textColor};
    }
  `}
`;

const LastSeenWrapper = styled(Flex)`
  color: ${p => p.theme.subText};
`;
