import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Mechanism} from 'sentry/components/events/interfaces/crashContent/exception/mechanism';
import {t} from 'sentry/locale';
import type {StackTraceMechanism} from 'sentry/types/stacktrace';

interface ExceptionHeaderProps {
  module: string | null;
  type: string;
}

const ExceptionHeaderHeading = styled(Heading)`
  display: inline-block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export function ExceptionHeader({type, module}: ExceptionHeaderProps) {
  return (
    <Tooltip title={t('from %s', module)} disabled={!module} skipWrapper>
      <ExceptionHeaderHeading as="h5" size="sm">
        {type}
      </ExceptionHeaderHeading>
    </Tooltip>
  );
}

interface ExceptionDescriptionProps {
  mechanism: StackTraceMechanism | null;
  value: string | null;
  gap?: 'sm' | 'md' | 'lg';
}

export function ExceptionDescription({
  value,
  mechanism,
  gap = 'sm',
}: ExceptionDescriptionProps) {
  return (
    <Flex direction="column" gap={gap}>
      {value && <ExceptionValue>{value}</ExceptionValue>}
      {mechanism && <Mechanism data={mechanism} />}
    </Flex>
  );
}

const ExceptionValue = styled('pre')`
  background: none;
  margin: 0;
  padding: 0;
  white-space: pre-wrap;
  word-break: break-word;
`;
