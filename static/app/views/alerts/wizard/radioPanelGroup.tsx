import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Radio} from 'sentry/components/core/radio';
import {space} from 'sentry/styles/space';

type RadioPanelGroupProps<C extends string> = {
  /**
   * An array of [id, name]
   */
  choices: Array<{
    id: C;
    name: React.ReactNode;
    badge?: React.ReactNode;
    trailingContent?: React.ReactNode;
  }>;
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
      {(choices || []).map(({id, name, badge, trailingContent}, index) => (
        <RadioPanel key={index}>
          <RadioLineItem role="radio" index={index} aria-checked={value === id}>
            <Flex align="center" gap="sm">
              <Radio
                size="sm"
                aria-label={id}
                checked={value === id}
                onChange={(e: React.FormEvent<HTMLInputElement>) => onChange(id, e)}
              />
              {name}
              {badge}
            </Flex>
            {trailingContent && <div>{trailingContent}</div>}
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
  display: flex;
  gap: ${p => p.theme.space.sm};
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  outline: none;
  font-weight: ${p => p.theme.fontWeight.normal};
  margin: 0;
  color: ${p => p.theme.tokens.content.secondary};
  transition: color 0.3s ease-in;
  padding: 0;
  position: relative;

  &:hover,
  &:focus {
    color: ${p => p.theme.tokens.content.primary};
  }

  &[aria-checked='true'] {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const RadioPanel = styled('div')`
  margin: 0;
`;
