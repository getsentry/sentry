import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {ExternalLink} from 'sentry/components/links/externalLink';
import {useConfigureReplayMenuItem} from 'sentry/components/replays/header/configureReplayMenuItem';
import {IconBug, IconCopyId, IconDelete, IconDownload, IconUpload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {downloadObjectAsJson} from 'sentry/utils/downloadObjectAsJson';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useDeleteReplay} from 'sentry/utils/replays/hooks/useDeleteReplay';
import {useShareReplayAtTimestamp} from 'sentry/utils/replays/hooks/useShareReplayAtTimestamp';
import type {ReplayReader} from 'sentry/utils/replays/replayReader';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ReplayRecord} from 'sentry/views/explore/replays/types';

interface Props {
  isMobile: boolean;
  projectSlug: string | null;
  replay: ReplayReader | undefined;
  // Accept the replay and replayRecord in case the replay doesn't load properly,
  // we still want to be able to sent the Delete request.
  replayRecord: ReplayRecord | undefined;
}

export function useReplayMenuItems({
  isMobile,
  projectSlug,
  replay,
  replayRecord,
}: Props): MenuItemProps[] {
  const organization = useOrganization();
  const isEmployee = useIsSentryEmployee();
  const isSuperUser = isActiveSuperuser();

  const replayId = replayRecord?.id;

  const canSeeEmployeeLinks = isEmployee || isSuperUser;
  const canDownload = projectSlug && replay;

  const onShareReplay = useShareReplayAtTimestamp();
  const {copy} = useCopyToClipboard();

  const canDelete = replayId && projectSlug;
  const onDeleteReplay = useDeleteReplay({replayId, projectSlug});

  const configureReplayItem = useConfigureReplayMenuItem({isMobile, replayRecord});

  const employeeItems = canSeeEmployeeLinks
    ? [
        {
          key: 'download-replay-record',
          label: t('Download Replay Record'),
          leadingItems: <IconDownload variant="muted" />,
          onAction: () => {
            if (!replay) {
              addErrorMessage(t('Replay not found'));
              return;
            }
            try {
              downloadObjectAsJson(replay.getReplay(), 'replay-record');
            } catch (error) {
              Sentry.captureException(error);
              addErrorMessage(
                t('Could not export replay record. Please wait or try again')
              );
            }
          },
          disabled: !canDownload,
        },
        {
          key: 'open-in-replay-debugger',
          label: tct('Debug in [link]', {
            link: (
              <ExternalLink href="https://github.com/getsentry/replay-debugger/releases">
                {t('Sentry Replay Debugger')}
              </ExternalLink>
            ),
          }),
          textValue: t('Debug in Sentry Replay Debugger'),
          leadingItems: <IconBug variant="muted" />,
          onAction: async () => {
            if (!replay) {
              addErrorMessage(t('Replay not found'));
              return;
            }
            try {
              const json = JSON.stringify(replay.getRRWebFrames());
              await navigator.clipboard.writeText(json);
              window.location.href = 'sentry-replay-debugger://open';
            } catch (error) {
              Sentry.captureException(error);
              addErrorMessage(t('Could not open replay debugger. Please try again.'));
            }
          },
          disabled: !canDownload,
        },
        isMobile
          ? {
              key: 'download-1st-video',
              label: t('Download 1st video segment (superuser)'),
              leadingItems: <IconDownload variant="muted" />,
              onAction: () =>
                window.location.assign(
                  `/api/0/projects/${organization.slug}/${projectSlug}/replays/${replayId}/videos/0/`
                ),
              disabled: !canDownload,
            }
          : null,
      ].filter(defined)
    : [];

  return [
    {
      key: 'copy-replay-id',
      label: t('Copy replay ID to clipboard'),
      leadingItems: <IconCopyId variant="muted" />,
      onAction: () => copy(replayId ?? ''),
      disabled: !replayId,
    },
    {
      key: 'share',
      label: t('Share'),
      leadingItems: <IconUpload variant="muted" />,
      onAction: onShareReplay,
      disabled: !replayId,
    },
    {
      key: 'download-rrweb',
      label: t('Download JSON'),
      leadingItems: <IconDownload variant="muted" />,
      onAction: () => {
        if (!replay) {
          addErrorMessage(t('Replay not found'));
          return;
        }
        try {
          downloadObjectAsJson(replay.getRRWebFrames(), 'rrweb');
        } catch (error) {
          Sentry.captureException(error);
          addErrorMessage(
            t('Could not export replay as rrweb data. Please wait or try again')
          );
        }
      },
      disabled: !canDownload,
    },
    {
      key: 'delete',
      label: t('Delete'),
      leadingItems: <IconDelete variant="muted" />,
      onAction: onDeleteReplay,
      disabled: !canDelete,
    },
    configureReplayItem,
    employeeItems.length > 0
      ? {
          key: 'sentry-employee-features',
          label: t('Sentry Employee Features'),
          children: employeeItems,
        }
      : null,
  ].filter(defined);
}
