import styled from '@emotion/styled';

import {
  getAttachmentUrl,
  ViewerProps,
} from 'app/components/events/attachmentViewers/utils';
import {PanelItem} from 'app/components/panels';

function ImageViewer({className, ...props}: ViewerProps) {
  return (
    <Container className={className}>
      <img src={getAttachmentUrl(props, true)} />
    </Container>
  );
}

export default ImageViewer;

const Container = styled(PanelItem)`
  justify-content: center;
`;
