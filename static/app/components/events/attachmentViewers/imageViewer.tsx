import styled from '@emotion/styled';

import {
  getAttachmentUrl,
  ViewerProps,
} from 'app/components/events/attachmentViewers/utils';
import {PanelItem} from 'app/components/panels';

type Props = Omit<ViewerProps, 'attachment'> & {
  attachment: Omit<ViewerProps['attachment'], 'event_id'> & {
    event_id?: string;
  };
};

function ImageViewer({className, ...props}: Props) {
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
