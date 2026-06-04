import styled from '@emotion/styled';

import {ImageViewer} from 'sentry/components/events/attachmentViewers/imageViewer';

export const ImageVisualization = styled(ImageViewer)`
  padding: 0;
  height: 100%;
  img {
    width: auto;
    height: 100%;
  }
`;
