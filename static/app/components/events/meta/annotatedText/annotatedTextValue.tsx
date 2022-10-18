import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {Organization, Project} from 'sentry/types';

import {Redaction} from './redaction';
import {getTooltipText} from './utils';
import {ValueElement} from './valueElement';

type Props = {
  value: React.ReactNode;
  meta?: Record<any, any>;
  organization?: Organization;
  project?: Project;
};

export function AnnotatedTextValue({value, meta, organization, project}: Props) {
  if (meta?.chunks?.length && meta.chunks.length > 1) {
    return (
      <ChunksSpan>
        {meta.chunks.map((chunk, index) => {
          if (chunk.type === 'redaction') {
            return (
              <Tooltip
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
    return (
      <Tooltip
        title={getTooltipText({
          rule_id: meta.rem[0][0],
          remark: meta.rem[0][1],
          organization,
          project,
        })}
        isHoverable
      >
        <ValueElement value={value} meta={meta} />
      </Tooltip>
    );
  }

  return <ValueElement value={value} meta={meta} />;
}

const ChunksSpan = styled('span')`
  span {
    display: inline;
  }
`;
