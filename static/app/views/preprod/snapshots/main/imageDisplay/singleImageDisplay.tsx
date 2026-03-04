import styled from '@emotion/styled';

import {Image} from '@sentry/scraps/image';
import {Flex} from '@sentry/scraps/layout';

interface SingleImageDisplayProps {
  alt: string;
  imageUrl: string;
}

export function SingleImageDisplay({imageUrl, alt}: SingleImageDisplayProps) {
  return (
    <Flex align="center" justify="center" height="100%" padding="3xl">
      <Flex
        width="100%"
        height="100%"
        padding="xl"
        justify="center"
        align="center"
        background="secondary"
        radius="md"
        border="primary"
      >
        <SnapshotImg src={imageUrl} alt={alt} />
      </Flex>
    </Flex>
  );
}

const SnapshotImg = styled(Image)`
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
`;
