import type React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import FormFieldControlState from 'sentry/components/forms/formField/controlState';
import type FormModel from 'sentry/components/forms/model';
import {inputStyles} from 'sentry/components/input';
import {InputGroup} from 'sentry/components/inputGroup';
import {space} from 'sentry/styles/space';

import type {InputFieldProps, OnEvent} from './inputField';
import InputField from './inputField';

export interface NumberFieldProps extends Omit<InputFieldProps, 'type'> {
  /**
   * Optional units/suffix to render inside the number input
   */
  suffix?: React.ReactNode;
}

function NumberField({suffix, ...props}: NumberFieldProps) {
  return (
    <InputField
      field={suffix ? createFieldWithSuffix({suffix}) : undefined}
      {...props}
      type="number"
    />
  );
}

export default NumberField;

/**
 * Custom field factory which can render an inline suffix
 * mostly copied from `inputField.tsx`
 */
function createFieldWithSuffix({suffix}: {suffix: React.ReactNode}) {
  return function fieldWithSuffix({
    onChange,
    onBlur,
    onKeyDown,
    model,
    name,
    hideControlState,
    ...rest
  }: {
    model: FormModel;
    name: string;
    onBlur: OnEvent;
    onChange: OnEvent;
    onKeyDown: OnEvent;
    suffix: React.ReactNode;
    value: string | number;
    alignRight?: boolean;
    hideControlState?: boolean;
    monospace?: NumberFieldProps['monospace'];
    placeholder?: string;
    size?: NumberFieldProps['size'];
  }) {
    const {size, monospace, alignRight} = rest;
    return (
      <InputGroup>
        <InputGroup.Input
          onBlur={e => onBlur(e.target.value, e)}
          onKeyDown={e => onKeyDown((e.target as any).value, e)}
          onChange={e => onChange(e.target.value, e)}
          name={name}
          {...rest}
        />
        <SuffixWrapper {...{size, monospace, alignRight}}>
          <HiddenValue aria-hidden>{rest.value || rest.placeholder}</HiddenValue>
          <Suffix>{suffix}</Suffix>
        </SuffixWrapper>
        {!hideControlState && (
          <InputGroup.TrailingItems>
            <FormFieldControlState model={model} name={name} />
          </InputGroup.TrailingItems>
        )}
      </InputGroup>
    );
  };
}
const SuffixWrapper = styled('span')<Omit<NumberFieldProps, 'name'>>`
  ${p => inputStyles(p)};
  color: transparent;
  background: transparent;
  border-color: transparent;
  box-shadow: inset transparent;
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
  text-overflow: clip;
  pointer-events: none;
  font-variant-numeric: tabular-nums;
  ${p =>
    p.alignRight
      ? css`
          text-align: right;
        `
      : undefined}
`;
const HiddenValue = styled('span')`
  visibility: hidden;
`;
const Suffix = styled('span')`
  color: ${p => p.theme.formPlaceholder};
  margin-left: ${space(0.5)};
`;
