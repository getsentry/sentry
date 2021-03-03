import React from 'react';
import styled from '@emotion/styled';

import {ChunkType} from 'app/types';

import Chunk from './chunk';

type Props = {
  chunks: Array<ChunkType>;
};

const Chunks = ({chunks}: Props) => (
  <ChunksSpan>
    {chunks.map((chunk, key) => React.cloneElement(<Chunk chunk={chunk} />, {key}))}
  </ChunksSpan>
);

export default Chunks;

const ChunksSpan = styled('span')`
  span {
    display: inline;
  }
`;
