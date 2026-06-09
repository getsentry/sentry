import styled from '@emotion/styled';

import {ImageViewer} from 'sentry/components/events/attachmentViewers/imageViewer';

export const ImageVisualization = styled(ImageViewer)`
  padding: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;
