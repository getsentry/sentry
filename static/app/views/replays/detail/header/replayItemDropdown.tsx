import * as Sentry from '@sentry/react';

import {Flex} from '@sentry/scraps/layout';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconDelete, IconDownload, IconEllipsis, IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {downloadObjectAsJson} from 'sentry/utils/downloadObjectAsJson';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useDeleteReplay from 'sentry/utils/replays/hooks/useDeleteReplay';
import useShareReplayAtTimestamp from 'sentry/utils/replays/hooks/useShareReplayAtTimestamp';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayRecord} from 'sentry/views/replays/types';

interface Props {
  projectSlug: string | null;
  replay: ReplayReader | undefined;
  // Accept the replay and replayRecord in case the replay doesn't load properly,
  // we still want to be able to sent the Delete request.
  replayRecord: ReplayRecord | undefined;
}

export default function ReplayItemDropdown({projectSlug, replay, replayRecord}: Props) {
  const navigate = useNavigate();
  const organization = useOrganization();
  const isEmployee = useIsSentryEmployee();
  const isSuperUser = isActiveSuperuser();

  const replayId = replayRecord?.id;
  const isMobile = replay?.isVideoReplay();

  const canSeeEmployeeLinks = isEmployee || isSuperUser;
  const canDownload = projectSlug && replay;

  const onShareReplay = useShareReplayAtTimestamp();

  const canDelete = replayId && projectSlug;
  const onDeleteReplay = useDeleteReplay({replayId, projectSlug});

  const dropdownItems: MenuItemProps[] = [
    {
      key: 'download-rrweb',
      label: (
        <Flex align="center" gap="md">
          <IconDownload />
          {t('Download JSON')}
        </Flex>
      ),
      onAction: () => {
        try {
          if (!replay) {
            addErrorMessage(t('Replay not found'));
            return;
          }
          downloadObjectAsJson(replay.getRRWebFrames(), 'rrweb');
        } catch (error) {
          Sentry.captureException(error);
          addErrorMessage(
            'Could not export replay as rrweb data. Please wait or try again'
          );
        }
      },
      disabled: !canDownload,
    },
    canSeeEmployeeLinks
      ? {
          key: 'download-replay-record',
          label: (
            <Flex align="center" gap="md">
              <IconDownload />
              {t('Download Replay Record (superuser)')}
            </Flex>
          ),
          onAction: () => {
            try {
              if (!replay) {
                addErrorMessage(t('Replay not found'));
                return;
              }
              downloadObjectAsJson(replay.getReplay(), 'replay-record');
            } catch (error) {
              Sentry.captureException(error);
              addErrorMessage('Could not export replay record. Please wait or try again');
            }
          },
          disabled: !canDownload,
        }
      : null,
    canSeeEmployeeLinks && isMobile
      ? {
          key: 'download-1st-video',
          label: (
            <Flex align="center" gap="md">
              <IconDownload />
              {t('Download 1st video segment (superuser)')}
            </Flex>
          ),
          onAction: () =>
            navigate(
              `/api/0/projects/${organization.slug}/${projectSlug}/replays/${replayId}/videos/0/`
            ),
          disabled: !canDownload,
        }
      : null,
    {
      key: 'share',
      label: (
        <Flex align="center" gap="md">
          <IconUpload />
          {t('Share')}
        </Flex>
      ),
      onAction: onShareReplay,
      disabled: !replayId,
    },
    {
      key: 'delete',
      label: (
        <Flex align="center" gap="md">
          <IconDelete />
          {t('Delete')}
        </Flex>
      ),
      onAction: onDeleteReplay,
      disabled: !canDelete,
    },
  ].filter(defined);

  return (
    <DropdownMenu
      position="bottom-end"
      triggerProps={{
        showChevron: false,
        icon: <IconEllipsis variant="muted" />,
      }}
      size="xs"
      items={dropdownItems}
      isDisabled={dropdownItems.length === 0}
    />
  );
}
