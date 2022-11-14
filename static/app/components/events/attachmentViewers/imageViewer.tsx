import styled from '@emotion/styled';

import {
  getAttachmentUrl,
  ViewerProps,
} from 'sentry/components/events/attachmentViewers/utils';
import {PanelItem} from 'sentry/components/panels';

type Props = Omit<ViewerProps, 'attachment'> & {
  attachment: ViewerProps['attachment'];
  onClick?: React.ReactEventHandler<HTMLImageElement>;
  onError?: React.ReactEventHandler<HTMLImageElement>;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
};

function ImageViewer({className, onClick, onLoad, onError, ...props}: Props) {
  return (
    <Container className={className} clickable={!!onClick}>
      <img
        data-test-id="image-viewer"
        src={getAttachmentUrl(props, true)}
        onLoad={onLoad}
        onError={onError}
        onClick={onClick}
      />
    </Container>
  );
}

export default ImageViewer;

const Container = styled(PanelItem)<{clickable: boolean}>`
  justify-content: center;
  ${p =>
    p.clickable &&
    `
    cursor: pointer;
  `}
`;
