import styled from '@emotion/styled';

import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';

type DetectorTypeCellProps = {
  type: DetectorType;
  className?: string;
  disabled?: boolean;
};

export function DetectorTypeCell({
  type,
  disabled = false,
  className,
}: DetectorTypeCellProps) {
  return (
    <Type disabled={disabled} className={className}>
      {getDetectorTypeLabel(type)}
    </Type>
  );
}

const Type = styled('div')<{disabled: boolean}>`
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.xs};

  ${p =>
    p.disabled &&
    `
    color: ${p.theme.tokens.content.disabled};
  `}
`;
