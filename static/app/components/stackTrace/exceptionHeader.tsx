import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Mechanism} from 'sentry/components/events/interfaces/crashContent/exception/mechanism';
import {renderLinksInText} from 'sentry/components/events/interfaces/crashContent/exception/utils';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {t} from 'sentry/locale';
import type {StackTraceMechanism} from 'sentry/types/stacktrace';

interface ExceptionHeaderProps {
  module: string | null;
  type: string;
}

const ExceptionHeaderHeading = styled(Heading)`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export function ExceptionHeader({type, module}: ExceptionHeaderProps) {
  return (
    <div>
      <Tooltip title={t('from %s', module)} disabled={!module}>
        <ExceptionHeaderHeading as="h5" size="md" wrap="nowrap">
          {type}
        </ExceptionHeaderHeading>
      </Tooltip>
    </div>
  );
}

interface ExceptionDescriptionProps {
  mechanism: StackTraceMechanism | null;
  value: string | null;
  gap?: 'sm' | 'md' | 'lg';
  meta?: Record<any, any>;
}

export function ExceptionDescription({
  value,
  mechanism,
  gap = 'sm',
  meta,
}: ExceptionDescriptionProps) {
  const valueMeta = meta?.value?.[''];

  return (
    <Flex direction="column" gap={gap}>
      {valueMeta && !value ? (
        <ExceptionValue>
          <AnnotatedText value={value} meta={valueMeta} />
        </ExceptionValue>
      ) : value ? (
        <ExceptionValue>{renderLinksInText({exceptionText: value})}</ExceptionValue>
      ) : null}
      {mechanism && <Mechanism data={mechanism} meta={meta?.mechanism} />}
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
