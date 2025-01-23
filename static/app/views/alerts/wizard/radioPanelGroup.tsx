import styled from '@emotion/styled';

import Radio from 'sentry/components/radio';
import {space} from 'sentry/styles/space';

type RadioPanelGroupProps<C extends string> = {
  /**
   * An array of [id, name]
   */
  choices: Array<[C, React.ReactNode, React.ReactNode?]>;
  label: string;
  onChange: (id: C, e: React.FormEvent<HTMLInputElement>) => void;
  value: string | null;
};

type Props<C extends string> = RadioPanelGroupProps<C> &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof RadioPanelGroupProps<C>>;

function RadioPanelGroup<C extends string>({
  value,
  choices,
  label,
  onChange,
  ...props
}: Props<C>) {
  return (
    <Container {...props} role="radiogroup" aria-labelledby={label}>
      {(choices || []).map(([id, name, extraContent], index) => (
        <RadioPanel key={index}>
          <RadioLineItem role="radio" index={index} aria-checked={value === id}>
            <Radio
              radioSize="small"
              aria-label={id}
              checked={value === id}
              onChange={(e: React.FormEvent<HTMLInputElement>) => onChange(id, e)}
            />
            <div>{name}</div>
            {extraContent}
          </RadioLineItem>
        </RadioPanel>
      ))}
    </Container>
  );
}

export default RadioPanelGroup;

const Container = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-auto-flow: row;
  grid-auto-rows: max-content;
  grid-auto-columns: auto;
`;

const RadioLineItem = styled('label')<{
  index: number;
}>`
  display: grid;
  gap: ${space(0.25)} ${space(1)};
  grid-template-columns: max-content auto max-content;
  align-items: center;
  cursor: pointer;
  outline: none;
  font-weight: ${p => p.theme.fontWeightNormal};
  margin: 0;
  color: ${p => p.theme.subText};
  transition: color 0.3s ease-in;
  padding: 0;
  position: relative;

  &:hover,
  &:focus {
    color: ${p => p.theme.textColor};
  }

  svg {
    display: none;
    opacity: 0;
  }

  &[aria-checked='true'] {
    color: ${p => p.theme.textColor};
  }
`;

const RadioPanel = styled('div')`
  margin: 0;
`;
