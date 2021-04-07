import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody} from 'app/components/panels';
import Radio from 'app/components/radio';
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
        <RadioPanelBody>
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
        </RadioPanelBody>
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
  grid-gap: 0.25em 0.5em;
  grid-template-columns: max-content auto max-content;
  align-items: center;
  cursor: pointer;
  outline: none;
  font-weight: normal;
  margin: 0;
`;

const RadioPanel = styled(Panel)`
  margin: 0;
`;

const RadioPanelBody = styled(PanelBody)`
  padding: ${space(1.5)};
`;
