import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {StacktraceType} from 'sentry/types/stacktrace';

export function OmittedFrames({
  omittedFrames,
}: {
  omittedFrames: StacktraceType['framesOmitted'];
}) {
  if (!omittedFrames) {
    return null;
  }

  const [start, end] = omittedFrames;
  return (
    <FramesOmittedListItem>
      {t('Frames %d to %d were omitted and not available.', start, end)}
    </FramesOmittedListItem>
  );
}

const FramesOmittedListItem = styled('li')`
  color: #493e54;
  font-size: 14px;
  font-weight: ${p => p.theme.fontWeight.bold};
  border-left: 2px solid ${p => p.theme.colors.red400};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.colors.red100};
  padding: ${space(1)} ${space(2)};
`;
