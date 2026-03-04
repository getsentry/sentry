import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Mechanism} from 'sentry/components/events/interfaces/crashContent/exception/mechanism';
import {t} from 'sentry/locale';
import type {StackTraceMechanism} from 'sentry/types/stacktrace';

export interface ExceptionHeaderProps {
  /** Exception class name, e.g. "TypeError" */
  type: string;
  /** Mechanism data for the mechanism pills row */
  mechanism?: StackTraceMechanism | null;
  /** Annotated-text metadata for mechanism pills */
  meta?: Record<string, any>;
  /** Module/namespace – rendered as a tooltip on the heading */
  module?: string | null;
  /** Exception message/value */
  value?: string | null;
}

/**
 * Renders the header area above a stack trace: exception type heading (with optional
 * module tooltip), exception value text, and mechanism pills.
 *
 * Designed to be composed alongside StackTraceProvider.Frames:
 *
 * ```tsx
 * <StackTraceProvider event={event} stacktrace={stacktrace}>
 *   <ExceptionHeader type={exc.type} value={exc.value} module={exc.module} mechanism={exc.mechanism} />
 *   <StackTraceProvider.Frames />
 * </StackTraceProvider>
 * ```
 */
export function ExceptionHeader({
  type,
  value,
  module: mod,
  mechanism,
  meta,
}: ExceptionHeaderProps) {
  return (
    <Flex direction="column" gap="sm">
      <div>
        <Tooltip title={t('from %s', mod)} disabled={!mod}>
          <Heading as="h5" size="lg">
            {type}
          </Heading>
        </Tooltip>
      </div>
      {value && <ExceptionValue>{value}</ExceptionValue>}
      {mechanism && <Mechanism data={mechanism} meta={meta} />}
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
