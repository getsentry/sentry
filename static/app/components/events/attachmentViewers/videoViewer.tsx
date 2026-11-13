import {css} from '@emotion/react';

import {t} from 'sentry/locale';
import {resolveHostname} from 'sentry/utils/api/resolveHostname';

import type {ViewerProps} from './utils';
import {getAttachmentUrl} from './utils';

interface WebMViewerProps
  extends
    Pick<ViewerProps, 'attachment' | 'eventId' | 'orgSlug' | 'projectSlug'>,
    Partial<Pick<HTMLVideoElement, 'controls'>> {
  className?: string;
  onCanPlay?: React.ReactEventHandler<HTMLVideoElement>;
}

export function VideoViewer({
  controls = true,
  attachment,
  onCanPlay,
  className,
  ...props
}: WebMViewerProps) {
  return (
    <video
      className={className}
      onCanPlay={onCanPlay}
      controls={controls}
      css={css`
        width: 100%;
        max-width: 100%;
      `}
    >
      <source
        src={resolveHostname(
          `/api/0${getAttachmentUrl({attachment, ...props})}?download`
        )}
        type={attachment.mimetype}
      />
      {t('Your browser does not support the video tag.')}
    </video>
  );
}
