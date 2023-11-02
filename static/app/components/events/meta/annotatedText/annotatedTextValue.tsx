import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {Redaction} from './redaction';
import {getTooltipText} from './utils';
import {ValueElement} from './valueElement';

type Props = {
  value: React.ReactNode;
  meta?: Record<any, any>;
};

function RemovedAnnotatedTextValue({value, meta}: Required<Props>) {
  const organization = useOrganization();
  const location = useLocation();
  const projectId = location.query.project;
  const {projects} = useProjects();
  const currentProject = projects.find(project => project.id === projectId);

  return (
    <Tooltip
      title={getTooltipText({
        rule_id: meta.rem[0][0],
        remark: meta.rem[0][1],
        organization,
        project: currentProject,
      })}
      isHoverable
    >
      <ValueElement value={value} meta={meta} />
    </Tooltip>
  );
}

export function AnnotatedTextValue({value, meta}: Props) {
  if (meta?.chunks?.length && meta.chunks.length > 1) {
    return (
      <ChunksSpan>
        {meta.chunks.map((chunk, index) => {
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
    return <RemovedAnnotatedTextValue value={value} meta={meta} />;
  }

  return <ValueElement value={value} meta={meta} />;
}

const ChunksSpan = styled('span')`
  word-break: break-word;
`;
