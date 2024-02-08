import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import UserBadge from 'sentry/components/idBadge/userBadge';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import ConfigureReplayCard from 'sentry/components/replays/configureReplayCard';
import DetailsPageBreadcrumbs from 'sentry/components/replays/header/detailsPageBreadcrumbs';
import FeedbackButton from 'sentry/components/replays/header/feedbackButton';
import HeaderPlaceholder from 'sentry/components/replays/header/headerPlaceholder';
import ReplayMetaData from 'sentry/components/replays/header/replayMetaData';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconDelete, IconEllipsis, IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import useDeleteReplay from 'sentry/utils/replays/hooks/useDeleteReplay';
import useShareReplayAtTimestamp from 'sentry/utils/replays/hooks/useShareReplayAtTimestamp';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  children: ReactNode;
  orgSlug: string;
  projectSlug: string | null;
  replayErrors: ReplayError[];
  replayRecord: undefined | ReplayRecord;
};

export default function Page({
  children,
  orgSlug,
  replayRecord,
  projectSlug,
  replayErrors,
}: Props) {
  const title = replayRecord
    ? `${replayRecord.id} — Session Replay — ${orgSlug}`
    : `Session Replay — ${orgSlug}`;

  const onShareReplay = useShareReplayAtTimestamp();
  const onDeleteReplay = useDeleteReplay({replayId: replayRecord?.id, projectSlug});

  const dropdownItems: MenuItemProps[] = [
    {
      key: 'share',
      label: (
        <ItemSpacer>
          <IconUpload size="sm" />
          {t('Share')}
        </ItemSpacer>
      ),
      onAction: onShareReplay,
    },
    replayRecord?.id && projectSlug
      ? {
          key: 'delete',
          label: (
            <ItemSpacer>
              <IconDelete size="sm" />
              {t('Delete')}
            </ItemSpacer>
          ),
          onAction: onDeleteReplay,
        }
      : null,
  ].filter(defined);

  const header = replayRecord?.is_archived ? (
    <Header>
      <DetailsPageBreadcrumbs orgSlug={orgSlug} replayRecord={replayRecord} />
    </Header>
  ) : (
    <Header>
      <DetailsPageBreadcrumbs orgSlug={orgSlug} replayRecord={replayRecord} />

      <ButtonActionsWrapper>
        <FeedbackButton />
        <ConfigureReplayCard />
        <DropdownMenu
          position="bottom-end"
          triggerProps={{
            showChevron: false,
            icon: <IconEllipsis color="subText" />,
          }}
          size="sm"
          items={dropdownItems}
        />
      </ButtonActionsWrapper>

      {replayRecord ? (
        <UserBadge
          avatarSize={32}
          displayName={
            <Layout.Title>
              {replayRecord.user.display_name || t('Anonymous User')}
            </Layout.Title>
          }
          user={{
            name: replayRecord.user.display_name || '',
            email: replayRecord.user.email || '',
            username: replayRecord.user.username || '',
            ip_address: replayRecord.user.ip || '',
            id: replayRecord.user.id || '',
          }}
          hideEmail
        />
      ) : (
        <HeaderPlaceholder width="100%" height="58px" />
      )}

      <ReplayMetaData replayRecord={replayRecord} replayErrors={replayErrors} />
    </Header>
  );

  return (
    <SentryDocumentTitle title={title}>
      <FullViewport>
        {header}
        {children}
      </FullViewport>
    </SentryDocumentTitle>
  );
}

const Header = styled(Layout.Header)`
  gap: ${space(1)};
  padding-bottom: ${space(1.5)};
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    gap: ${space(1)} ${space(3)};
    padding: ${space(2)} ${space(2)} ${space(1.5)} ${space(2)};
  }
`;

// TODO(replay); This could make a lot of sense to put inside HeaderActions by default
const ButtonActionsWrapper = styled(Layout.HeaderActions)`
  flex-direction: row;
  justify-content: flex-end;
  gap: ${space(1)};
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    margin-bottom: 0;
  }
`;

const ItemSpacer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;
