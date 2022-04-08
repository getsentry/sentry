import styled from '@emotion/styled';

import {
  getAttachmentUrl,
  ViewerProps,
} from 'sentry/components/events/attachmentViewers/utils';
import {PanelItem} from 'sentry/components/panels';

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
