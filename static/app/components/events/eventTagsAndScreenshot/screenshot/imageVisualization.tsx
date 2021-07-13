import styled from '@emotion/styled';

import ImageViewer from 'app/components/events/attachmentViewers/imageViewer';

const ImageVisualization = styled(ImageViewer)`
  padding: 0;
  height: 100%;
  img {
    width: auto;
    height: 100%;
    object-fit: cover;
    flex: 1;
  }
`;

export default ImageVisualization;
