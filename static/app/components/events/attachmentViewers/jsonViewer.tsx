import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import ContextData from 'sentry/components/contextData';
import PreviewPanelItem from 'sentry/components/events/attachmentViewers/previewPanelItem';
import {
  getAttachmentUrl,
  ViewerProps,
} from 'sentry/components/events/attachmentViewers/utils';

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
        <StyledContextData
          data={json}
          maxDefaultDepth={4}
          preserveQuotes
          style={{width: '100%'}}
          jsonConsts
        />
      </PreviewPanelItem>
    );
  }
}

const StyledContextData = styled(ContextData)`
  margin-bottom: 0;
`;
