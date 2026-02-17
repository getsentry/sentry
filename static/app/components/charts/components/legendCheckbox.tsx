import styled from '@emotion/styled';

const CHECKBOX_SIZE = '12px';
const ICON_SIZE = '10px';
const BORDER_RADIUS = '2px';

interface LegendCheckboxProps {
  checked: boolean;
  color: string;
  onChange: () => void;
  'aria-label'?: string;
}

export function LegendCheckbox({
  checked,
  color,
  onChange,
  'aria-label': ariaLabel,
}: LegendCheckboxProps) {
  return (
    <Wrapper>
      <NativeCheckbox
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={ariaLabel}
      />
      <FakeCheckbox checked={checked} color={color} aria-hidden>
        {checked && (
          <CheckIcon viewBox="0 0 16 16">
            <path d="M2.86 9.14C4.42 10.7 6.9 13.14 6.86 13.14L12.57 3.43" />
          </CheckIcon>
        )}
      </FakeCheckbox>
    </Wrapper>
  );
}

const NativeCheckbox = styled('input')`
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  margin: 0;
  padding: 0;
  cursor: pointer;

  &:focus-visible + div {
    ${p => p.theme.focusRing()};
  }
`;

const FakeCheckbox = styled('div')<{checked: boolean; color: string}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${CHECKBOX_SIZE};
  height: ${CHECKBOX_SIZE};
  border-radius: ${BORDER_RADIUS};
  background-color: ${p => (p.checked ? p.color : 'transparent')};
  border: 1px solid ${p => (p.checked ? p.color : p.theme.tokens.border.primary)};
  pointer-events: none;
`;

const CheckIcon = styled('svg')`
  width: ${ICON_SIZE};
  height: ${ICON_SIZE};
  fill: none;
  stroke: white;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8px;
`;

const Wrapper = styled('div')`
  position: relative;
  cursor: pointer;
  display: inline-flex;
  border-radius: ${BORDER_RADIUS};
  flex-shrink: 0;
`;
