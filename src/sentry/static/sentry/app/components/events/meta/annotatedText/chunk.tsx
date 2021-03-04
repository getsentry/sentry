import React from 'react';

import Tooltip from 'app/components/tooltip';
import {ChunkType} from 'app/types';

import Redaction from './redaction';
import {getTooltipText} from './utils';

type Props = {
  chunk: ChunkType;
};

const Chunk = ({chunk}: Props) => {
  if (chunk.type === 'redaction') {
    const title = getTooltipText({rule_id: chunk.rule_id, remark: chunk.remark});
    return (
      <Tooltip title={title}>
        <Redaction>{chunk.text}</Redaction>
      </Tooltip>
    );
  }

  return <span>{chunk.text}</span>;
};

export default Chunk;
