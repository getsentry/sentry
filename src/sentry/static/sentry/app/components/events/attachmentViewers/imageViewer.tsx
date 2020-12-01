import React from 'react';

import {
  getAttachmentUrl,
  ViewerProps,
} from 'app/components/events/attachmentViewers/utils';
import {PanelItem} from 'app/components/panels';

export default function ImageViewer(props: ViewerProps) {
  return (
    <PanelItem justifyContent="center">
      <img src={getAttachmentUrl(props, true)} />
    </PanelItem>
  );
}
