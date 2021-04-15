import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody} from 'app/components/panels';
import Radio from 'app/components/radio';
import {IconChevron} from 'app/icons';
import space from 'app/styles/space';

type RadioPanelGroupProps<C extends string> = {
  label: string;
  /**
   * An array of [id, name]
   */
  choices: [C, React.ReactNode, React.ReactNode?][];
  value: string | null;
  onChange: (id: C, e: React.FormEvent<HTMLInputElement>) => void;
};

type Props<C extends string> = RadioPanelGroupProps<C> &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof RadioPanelGroupProps<C>>;

const RadioPanelGroup = <C extends string>({
  value,
  choices,
  label,
  onChange,
  ...props
}: Props<C>) => (
  <Container {...props} role="radiogroup" aria-labelledby={label}>
    {(choices || []).map(([id, name, extraContent], index) => (
      <RadioPanel key={index}>
        <PanelBody>
          <RadioLineItem role="radio" index={index} aria-checked={value === id}>
            <Radio
              radioSize="small"
              aria-label={id}
              checked={value === id}
              onChange={(e: React.FormEvent<HTMLInputElement>) => onChange(id, e)}
            />
            <div>{name}</div>
            {extraContent}
            <IconChevron direction="right" />
          </RadioLineItem>
        </PanelBody>
      </RadioPanel>
    ))}
  </Container>
);

export default RadioPanelGroup;

const Container = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  grid-auto-flow: row;
  grid-auto-rows: max-content;
  grid-auto-columns: auto;
`;

export const RadioLineItem = styled('label')<{
  index: number;
}>`
  display: grid;
  grid-gap: ${space(0.25)} ${space(1)};
  grid-template-columns: max-content auto max-content;
  align-items: center;
  cursor: pointer;
  outline: none;
  font-weight: normal;
  margin: 0;
  color: ${p => p.theme.subText};
  transition: color 0.3s ease-in;
  padding: ${space(1.5)};
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

    svg {
      display: block;
      opacity: 1 !important;
      animation: none !important;
    }

    span {
      display: none;
    }
  }

  &:hover {
    svg {
      display: block;
      animation: svgpop 0.2s ease-in forwards;
    }
    span {
      display: none;
    }
  }

  @keyframes svgpop {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 0.5;
    }
  }
`;

const RadioPanel = styled(Panel)`
  margin: 0;
`;
