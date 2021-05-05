import styled from '@emotion/styled';

import {
  getAttachmentUrl,
  ViewerProps,
} from 'app/components/events/attachmentViewers/utils';
import {PanelItem} from 'app/components/panels';

export default function ImageViewer(props: ViewerProps) {
  return (
    <Container>
      <img src={getAttachmentUrl(props, true)} />
    </Container>
  );
}

const Container = styled(PanelItem)`
  justify-content: center;
`;
