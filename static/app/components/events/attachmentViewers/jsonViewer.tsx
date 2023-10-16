import styled from '@emotion/styled';

import ContextData from 'sentry/components/contextData';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import PreviewPanelItem from 'sentry/components/events/attachmentViewers/previewPanelItem';
import {
  getAttachmentUrl,
  ViewerProps,
} from 'sentry/components/events/attachmentViewers/utils';

type Props = ViewerProps & DeprecatedAsyncComponent['props'];

type State = DeprecatedAsyncComponent['state'];

export default class JsonViewer extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    return [
      [
        'attachmentJson',
        getAttachmentUrl(this.props),
        {headers: {Accept: '*/*; charset=utf-8'}},
      ],
    ];
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
