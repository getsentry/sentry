import styled from '@emotion/styled';

import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';

type DetectorTypeCellProps = {
  type: DetectorType;
  className?: string;
};

export function DetectorTypeCell({type, className}: DetectorTypeCellProps) {
  return <Type className={className}>{getDetectorTypeLabel(type)}</Type>;
}

const Type = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.xs};
`;
