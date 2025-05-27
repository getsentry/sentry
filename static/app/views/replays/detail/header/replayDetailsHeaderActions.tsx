import styled from '@emotion/styled';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import ConfigureMobileReplayCard from 'sentry/components/replays/configureMobileReplayCard';
import ConfigureReplayCard from 'sentry/components/replays/configureReplayCard';
import FeedbackButton from 'sentry/components/replays/header/feedbackButton';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import {IconDelete, IconEllipsis, IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDeleteReplay from 'sentry/utils/replays/hooks/useDeleteReplay';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import useShareReplayAtTimestamp from 'sentry/utils/replays/hooks/useShareReplayAtTimestamp';
import type {ReplayRecord} from 'sentry/views/replays/types';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export default function ReplayDetailsHeaderActions({readerResult}: Props) {
  return (
    <ReplayLoadingState
      readerResult={readerResult}
      renderArchived={() => null}
      renderError={() => null}
      renderLoading={() => <Placeholder height="33px" width="203px" />}
      renderMissing={() => null}
      renderProcessingError={({replayRecord, projectSlug}) => (
        <ButtonActionsWrapper>
          <FeedbackButton />
          <ConfigureReplayCard />
          <ReplayItemDropdown replayRecord={replayRecord} projectSlug={projectSlug} />
        </ButtonActionsWrapper>
      )}
    >
      {({replay}) => (
        <ButtonActionsWrapper>
          {replay.isVideoReplay() ? <FeedbackWidgetButton /> : <FeedbackButton />}
          {replay.isVideoReplay() ? (
            <ConfigureMobileReplayCard replayRecord={replay.getReplay()} />
          ) : (
            <ConfigureReplayCard />
          )}
          <ReplayItemDropdown
            replayRecord={replay.getReplay()}
            projectSlug={readerResult.projectSlug}
          />
        </ButtonActionsWrapper>
      )}
    </ReplayLoadingState>
  );
}

function ReplayItemDropdown({
  replayRecord,
  projectSlug,
}: {
  projectSlug: string | null;
  replayRecord: ReplayRecord | undefined;
}) {
  const onShareReplay = useShareReplayAtTimestamp();
  const onDeleteReplay = useDeleteReplay({
    replayId: replayRecord?.id,
    projectSlug,
  });

  const dropdownItems: MenuItemProps[] = replayRecord
    ? [
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
        {
          key: 'delete',
          label: (
            <ItemSpacer>
              <IconDelete size="sm" />
              {t('Delete')}
            </ItemSpacer>
          ),
          onAction: onDeleteReplay,
        },
      ]
    : [];

  return (
    <DropdownMenu
      position="bottom-end"
      triggerProps={{
        showChevron: false,
        icon: <IconEllipsis color="subText" />,
      }}
      size="sm"
      items={dropdownItems}
      isDisabled={dropdownItems.length === 0}
    />
  );
}

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
