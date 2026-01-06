import styled from '@emotion/styled';

import {IconWarning} from 'sentry/icons';

const _OffsetContainer = styled('span')`
  position: relative;
  top: 2px;
`;

const _Placeholder = styled('div')<{width: number}>`
  display: inline-block;
  width: ${p => p.width}px;
  height: ${p => p.theme.fontSize.md};
  border-radius: ${p => p.theme.radius.md};
  background-color: ${p => p.theme.backgroundTertiary};
`;

interface PlaceholderProps {
  width: number;
}

export function Placeholder({width}: PlaceholderProps) {
  return (
    <_OffsetContainer data-test-id="loading-placeholder">
      <_Placeholder width={width} />
    </_OffsetContainer>
  );
}

export function WarningIcon() {
  return (
    <_OffsetContainer data-test-id="warning-placeholder">
      <IconWarning size="sm" />
    </_OffsetContainer>
  );
}
