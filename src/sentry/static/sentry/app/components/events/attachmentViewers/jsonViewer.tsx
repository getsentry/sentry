import React from 'react';

import {
  ViewerProps,
  getAttachmentUrl,
} from 'app/components/events/attachmentViewers/utils';
import PreviewPanelItem from 'app/components/events/attachmentViewers/previewPanelItem';
import AsyncComponent from 'app/components/asyncComponent';
import ContextData from 'app/components/contextData';

type Props = ViewerProps & AsyncComponent['props'];

type State = AsyncComponent['state'];

export default class JsonViewer extends AsyncComponent<Props, State> {
  getEndpoints(): [string, string][] {
    return [['attachmentJson', getAttachmentUrl(this.props)]];
  }

  renderBody() {
    const {attachmentJson} = this.state;
    if (!attachmentJson) {
      return null;
    }

    let json;
    try {
      json = JSON.parse(attachmentJson);
    } catch (e) {
      json = null;
    }

    return (
      <PreviewPanelItem>
        <ContextData data={json} preserveQuotes style={{width: '100%'}} />
      </PreviewPanelItem>
    );
  }
}
