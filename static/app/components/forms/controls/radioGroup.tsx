import {Fragment} from 'react';
import type {PopperProps} from 'react-popper';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {Radio} from 'sentry/components/radio';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientInline?: boolean;
}

interface BaseRadioGroupProps<C extends string> {
  /**
   * The choices availiable in the group
   */
  choices: Array<RadioOption<C>>;
  /**
   * Labels the radio group.
   */
  label: string;
  onChange: (id: C, e: React.FormEvent<HTMLInputElement>) => void;
  value: string | number | null;
  disabled?: boolean;
  /**
   * An array of [choice id, disabled reason]
   */
  disabledChoices?: Array<[C, React.ReactNode?]>;
  /**
   * Switch the radio items to flow left to right, instead of vertically.
   */
  orientInline?: boolean;
  tooltipPosition?: PopperProps<any>['placement'];
}

/**
 * A single option in a radio group
 */
export type RadioOption<C extends string = string> = [
  id: C,
  label: React.ReactNode,
  description?: React.ReactNode,
];

export interface RadioGroupProps<C extends string = string>
  extends BaseRadioGroupProps<C>,
    Omit<ContainerProps, 'onChange'> {
  name?: string;
}

function RadioGroup<C extends string>({
  name: groupName,
  value,
  disabled: groupDisabled,
  disabledChoices = [],
  choices = [],
  label,
  onChange,
  orientInline,
  tooltipPosition,
  ...props
}: RadioGroupProps<C>) {
  return (
    <Container
      orientInline={orientInline}
      {...props}
      role="radiogroup"
      aria-label={label}
    >
      {choices.map(([id, name, description], index) => {
        const disabledChoice = disabledChoices.find(([choiceId]) => choiceId === id);
        const disabledChoiceReason = disabledChoice?.[1];
        const disabled = !!disabledChoice || groupDisabled;

        // TODO(epurkhiser): There should be a `name` and `label` attribute in
        // the options type to allow for the aria label to work correctly. For
        // now we slap a `toString` on there, but it may sometimes return
        // [object Object] if the name is a react node.

        return (
          <Tooltip
            key={index}
            disabled={!disabledChoiceReason}
            title={disabledChoiceReason}
            position={tooltipPosition}
          >
            <RadioLineItem index={index} aria-checked={value === id} disabled={disabled}>
              <Radio
                name={groupName}
                aria-label={name?.toString()}
                disabled={disabled}
                checked={value === id}
                onChange={(e: React.FormEvent<HTMLInputElement>) =>
                  !disabled && onChange(id, e)
                }
              />
              <RadioLineText disabled={disabled}>{name}</RadioLineText>
              {description && (
                <Fragment>
                  {/* If there is a description then we want to have a 2x2 grid so the first column width aligns with Radio Button */}
                  <div />
                  <Description>{description}</Description>
                </Fragment>
              )}
            </RadioLineItem>
          </Tooltip>
        );
      })}
    </Container>
  );
}

const Container = styled('div')<ContainerProps>`
  display: flex;
  gap: ${p => space(p.orientInline ? 3 : 1)};
  flex-direction: ${p => (p.orientInline ? 'row' : 'column')};
`;

const shouldForwardProp = (p: PropertyKey) =>
  typeof p === 'string' && !['disabled', 'animate'].includes(p) && isPropValid(p);

export const RadioLineItem = styled('label', {shouldForwardProp})<{
  index: number;
  disabled?: boolean;
}>`
  display: grid;
  gap: 0.25em 0.5em;
  grid-template-columns: max-content auto;
  align-items: center;
  cursor: ${p => (p.disabled ? 'default' : 'pointer')};
  outline: none;
  font-weight: ${p => p.theme.fontWeightNormal};
  margin: 0;
`;

const RadioLineText = styled('div', {shouldForwardProp})<{disabled?: boolean}>`
  opacity: ${p => (p.disabled ? 0.4 : null)};
`;

const Description = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  line-height: 1.4em;
`;

export default RadioGroup;
