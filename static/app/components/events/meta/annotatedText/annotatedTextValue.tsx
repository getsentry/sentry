import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';

import {FilteredAnnotatedTextValue} from './filteredAnnotatedTextValue';
import {Redaction} from './redaction';
import {getTooltipText} from './utils';
import {ValueElement} from './valueElement';

type Props = {
  value: React.ReactNode;
  meta?: Record<any, any>;
};

export function AnnotatedTextValue({value, meta}: Props) {
  if (meta?.chunks?.length && meta.chunks.length > 1) {
    return (
      <ChunksSpan>
        {meta.chunks.map((chunk: any, index: any) => {
          if (chunk.type === 'redaction') {
            return (
              <Tooltip
                skipWrapper
                title={getTooltipText({rule_id: chunk.rule_id, remark: chunk.remark})}
                key={index}
              >
                <Redaction>{chunk.text}</Redaction>
              </Tooltip>
            );
          }

          return chunk.text;
        })}
      </ChunksSpan>
    );
  }

  if (meta?.rem?.length) {
    return <FilteredAnnotatedTextValue value={value} meta={meta} />;
  }

  return <ValueElement value={value} meta={meta} />;
}

const ChunksSpan = styled('span')`
  word-break: break-word;
`;
