import styled from '@emotion/styled';

import {
  getAttachmentUrl,
  ViewerProps,
} from 'sentry/components/events/attachmentViewers/utils';
import PanelItem from 'sentry/components/panels/panelItem';

type Props = Omit<ViewerProps, 'attachment'> & {
  attachment: ViewerProps['attachment'];
  onError?: React.ReactEventHandler<HTMLImageElement>;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
};

function ImageViewer({className, onLoad, onError, ...props}: Props) {
  return (
    <Container className={className}>
      <img
        data-test-id="image-viewer"
        src={getAttachmentUrl(props, true)}
        onLoad={onLoad}
        onError={onError}
      />
    </Container>
  );
}

export default ImageViewer;

const Container = styled(PanelItem)`
  justify-content: center;
`;
