import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {capitalize} from 'sentry/utils/string/capitalize';

export type TypeCellProps = {
  type: DetectorType;
  className?: string;
  disabled?: boolean;
};

export function TypeCell({type, disabled = false, className}: TypeCellProps) {
  return (
    <Type disabled={disabled} className={className}>
      {capitalize(type)}
    </Type>
  );
}

const Type = styled('div')<{disabled: boolean}>`
  color: ${p => p.theme.textColor};
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};

  ${p =>
    p.disabled &&
    `
    color: ${p.theme.disabled};
  `}
`;
