import {css} from '@emotion/react';

import type {ViewerProps} from 'sentry/components/events/attachmentViewers/utils';
import {getAttachmentUrl} from 'sentry/components/events/attachmentViewers/utils';
import PanelItem from 'sentry/components/panels/panelItem';
import {t} from 'sentry/locale';

interface WebMViewerProps
  extends Pick<ViewerProps, 'attachment' | 'eventId' | 'orgSlug' | 'projectSlug'>,
    Partial<Pick<HTMLVideoElement, 'controls'>> {
  onCanPlay?: React.ReactEventHandler<HTMLVideoElement>;
}

export function VideoViewer({
  controls = true,
  attachment,
  onCanPlay,
  ...props
}: WebMViewerProps) {
  return (
    <PanelItem>
      <video
        onCanPlay={onCanPlay}
        controls={controls}
        css={css`
          width: 100%;
          max-width: 100%;
        `}
      >
        <source
          src={getAttachmentUrl({attachment, ...props}, true)}
          type={attachment.mimetype}
        />
        {t('Your browser does not support the video tag.')}
      </video>
    </PanelItem>
  );
}
