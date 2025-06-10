import {css} from '@emotion/react';

import type {ViewerProps} from 'sentry/components/events/attachmentViewers/utils';
import {getAttachmentUrl} from 'sentry/components/events/attachmentViewers/utils';
import PanelItem from 'sentry/components/panels/panelItem';
import {t} from 'sentry/locale';

interface WebMViewerProps
  extends Pick<ViewerProps, 'attachment' | 'eventId' | 'orgSlug' | 'projectSlug'> {}

export function WebMViewer(props: WebMViewerProps) {
  return (
    <PanelItem>
      <video
        controls
        css={css`
          max-width: 100%;
        `}
      >
        <source src={getAttachmentUrl(props, true)} type="video/webm" />
        {t('Your browser does not support the video tag.')}
      </video>
    </PanelItem>
  );
}
