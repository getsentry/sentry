import {Fragment, type ReactNode} from 'react';
import styled from '@emotion/styled';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import UserBadge from 'sentry/components/idBadge/userBadge';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import ConfigureMobileReplayCard from 'sentry/components/replays/configureMobileReplayCard';
import ConfigureReplayCard from 'sentry/components/replays/configureReplayCard';
import DetailsPageBreadcrumbs from 'sentry/components/replays/header/detailsPageBreadcrumbs';
import FeedbackButton from 'sentry/components/replays/header/feedbackButton';
import ReplayMetaData from 'sentry/components/replays/header/replayMetaData';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar, IconDelete, IconEllipsis, IconUpload} from 'sentry/icons';
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
  isLoading?: boolean;
  isVideoReplay?: boolean;
};

export default function Page({
  children,
  orgSlug,
  replayRecord,
  projectSlug,
  replayErrors,
  isVideoReplay,
  isLoading,
}: Props) {
  const title = replayRecord
    ? `${replayRecord.user.display_name ?? t('Anonymous User')} — Session Replay — ${orgSlug}`
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
      <DetailsPageBreadcrumbs
        orgSlug={orgSlug}
        replayRecord={replayRecord}
        isVideoReplay={isVideoReplay}
      />
    </Header>
  ) : (
    <Header>
      <DetailsPageBreadcrumbs
        orgSlug={orgSlug}
        replayRecord={replayRecord}
        isVideoReplay={isVideoReplay}
      />

      <ButtonActionsWrapper>
        {isLoading ? (
          <Placeholder height="33px" width="203px" />
        ) : (
          <Fragment>
            {isVideoReplay ? <FeedbackWidgetButton /> : <FeedbackButton />}
            {isVideoReplay ? <ConfigureMobileReplayCard /> : <ConfigureReplayCard />}
          </Fragment>
        )}

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
          avatarSize={24}
          displayName={
            <DisplayHeader>
              <Title>{replayRecord.user.display_name || t('Anonymous User')}</Title>
              {replayRecord && (
                <TimeContainer>
                  <IconCalendar color="gray300" size="xs" />
                  <TimeSince
                    date={replayRecord.started_at}
                    isTooltipHoverable
                    unitStyle="regular"
                  />
                </TimeContainer>
              )}
            </DisplayHeader>
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
        <Placeholder width="30%" height="45px" />
      )}

      <ReplayMetaData
        replayRecord={replayRecord}
        replayErrors={replayErrors}
        showDeadRageClicks={!isVideoReplay}
        isLoading={isLoading}
      />
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

const Title = styled('h1')`
  ${p => p.theme.overflowEllipsis};
  ${p => p.theme.text.pageTitle};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.headingColor};
  margin: 0;
  line-height: 1.4;
`;

const TimeContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1.4;
`;

const DisplayHeader = styled('div')`
  display: flex;
  flex-direction: column;
`;
