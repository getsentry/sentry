import {ClassNames} from '@emotion/react';

import {Button} from 'sentry/components/core/button';
import {Hovercard} from 'sentry/components/hovercard';
import {ButtonContainer, Resource} from 'sentry/components/replays/configureReplayCard';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import type {ReplayRecord} from 'sentry/views/replays/types';

function DownloadResourceButtons({
  replayId,
  projectId,
}: {
  projectId: string | undefined;
  replayId: string | undefined;
}) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: projectId});

  const host = organization.links.regionUrl;
  const jsonUrl = replayId
    ? `${host}/api/0/organizations/${organization.slug}/replays/${replayId}/`
    : '';
  const videoUrl = project
    ? `${host}/api/0/projects/${organization.slug}/${project.slug}/replays/${replayId}/videos/0/`
    : '';

  return (
    <ButtonContainer>
      <Resource
        disabled={!replayId}
        title={t('Download JSON')}
        subtitle={t('Get Replay Metadata in a JSON format.')}
        link={jsonUrl}
      />
      <Resource
        disabled={!project || !replayId}
        title={t('Download Video')}
        subtitle={t('Get the first video segment of the Replay.')}
        link={videoUrl}
      />
    </ButtonContainer>
  );
}

export default function DownloadMobileReplayCard({
  replayRecord,
}: {
  replayRecord: ReplayRecord | undefined;
}) {
  return (
    <ClassNames>
      {({css}) => (
        <Hovercard
          body={
            <DownloadResourceButtons
              replayId={replayRecord?.id ? undefined : undefined}
              projectId={undefined}
            />
          }
          bodyClassName={css`
            padding: ${space(1)};
          `}
          position="top-end"
        >
          <Button
            size="sm"
            icon={<IconDownload />}
            aria-label={t('replay json metadata download')}
          />
        </Hovercard>
      )}
    </ClassNames>
  );
}
