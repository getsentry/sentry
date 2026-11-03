import type * as React from 'react';
import {useCallback, useId} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {AnimatePresence, motion, useReducedMotion} from 'framer-motion';

import {Container, Flex, Stack, type ContainerProps} from '@sentry/scraps/layout';
import type {Theme} from '@sentry/scraps/theme';

interface CommonProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  autoFocus?: boolean;
  disabled?: boolean;
  padding?: ContainerProps['padding'];
  ref?: React.Ref<HTMLElement>;
}

interface SelectionProps extends Omit<CommonProps, 'onClick'> {
  checked: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  variant: 'radio' | 'checkbox';
  details?: React.ReactNode;
  name?: string;
  onClick?: never;
  required?: boolean;
  value?: React.InputHTMLAttributes<HTMLInputElement>['value'];
}

interface ActionProps
  extends
    CommonProps,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps | 'type'> {
  variant: 'button';
  checked?: never;
  details?: never;
  onChange?: never;
  required?: never;
}

export type ToggleCardProps = SelectionProps | ActionProps;

function ToggleCardRoot(props: ToggleCardProps) {
  const {ref, children, className, style, disabled, autoFocus, padding = 'xl'} = props;
  const detailsId = useId();
  const reducedMotion = useReducedMotion();
  const setRef = useCallback(
    (element: HTMLElement | null) => {
      if (typeof ref === 'function') {
        return ref(element);
      }
      if (ref) {
        ref.current = element;
      }
    },
    [ref]
  );

  if (props.variant === 'button') {
    const {
      variant,
      onClick,
      checked: _checked,
      details: _details,
      ref: _ref,
      padding: _padding,
      className: _className,
      style: _style,
      ...buttonProps
    } = props;
    return (
      <Surface
        ref={setRef}
        className={className}
        style={style}
        data-variant={variant}
        aria-disabled={disabled || undefined}
      >
        <Stack height="100%" data-toggle-card-face>
          <ButtonTrigger
            {...buttonProps}
            type="button"
            disabled={undefined}
            aria-disabled={disabled || undefined}
            autoFocus={autoFocus}
            data-toggle-card-trigger
            onClick={event => {
              if (disabled) {
                event.preventDefault();
              } else {
                onClick?.(event);
              }
            }}
          >
            <Container height="100%" padding={padding}>
              {children}
            </Container>
          </ButtonTrigger>
        </Stack>
      </Surface>
    );
  }

  const {
    variant,
    checked,
    onChange,
    details,
    name,
    value,
    required,
    id,
    tabIndex,
    disabled: _disabled,
    autoFocus: _autoFocus,
    ref: _ref,
    children: _children,
    padding: _padding,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-description': ariaDescription,
    'aria-invalid': ariaInvalid,
    'aria-errormessage': ariaErrorMessage,
    ...surfaceProps
  } = props;

  return (
    <Surface
      {...surfaceProps}
      ref={setRef}
      className={className}
      style={style}
      aria-disabled={disabled || undefined}
      data-checked={checked}
      data-variant={variant}
    >
      <Stack height="100%" data-toggle-card-face>
        <LabelTrigger>
          <SelectionInput
            id={id}
            tabIndex={tabIndex}
            type={variant}
            name={disabled ? undefined : name}
            value={value}
            checked={checked}
            required={disabled ? undefined : required}
            autoFocus={autoFocus}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-description={ariaDescription}
            aria-invalid={ariaInvalid}
            aria-errormessage={ariaErrorMessage}
            aria-disabled={disabled || undefined}
            aria-controls={checked && details ? detailsId : undefined}
            data-toggle-card-input
            onClickCapture={event => {
              if (disabled) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            onChange={event => {
              if (!disabled) {
                onChange(event);
              }
            }}
          />
          <Container height="100%" padding={padding}>
            {children}
          </Container>
        </LabelTrigger>
        <AnimatePresence initial={false}>
          {checked && details && (
            <motion.div
              key="details"
              id={detailsId}
              initial={{height: 0, opacity: 0, overflow: 'hidden'}}
              animate={{
                height: 'auto',
                opacity: 1,
                overflow: 'hidden',
                transitionEnd: {overflow: 'visible'},
              }}
              exit={{height: 0, opacity: 0, overflow: 'hidden'}}
              transition={{duration: reducedMotion ? 0 : 0.2, ease: 'easeOut'}}
            >
              <Container padding={padding} paddingTop="0">
                {details}
              </Container>
            </motion.div>
          )}
        </AnimatePresence>
      </Stack>
    </Surface>
  );
}

function ToggleCardIndicator() {
  return (
    <Indicator
      as="span"
      align="center"
      justify="center"
      width="20px"
      height="20px"
      flexShrink={0}
      aria-hidden
      pointerEvents="none"
    >
      <IconCheckmark size="xs" />
    </Indicator>
  );
}

export const ToggleCard = Object.assign(ToggleCardRoot, {Indicator: ToggleCardIndicator});

const Surface = styled('div')`
  --card-lift: 2px;
  --card-chonk: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
  --card-indicator-radius: ${p => p.theme.radius.full};
  --card-indicator-background: ${p => p.theme.tokens.background.primary};
  --card-indicator-border: ${p => p.theme.tokens.border.primary};
  --card-radio-dot: 0;
  --card-checkbox-mark: 0;
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: ${p => p.theme.radius.md};
  color: ${p => p.theme.tokens.content.primary};
  cursor: pointer;

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }
  &::before {
    background: var(--card-chonk);
  }
  &::after {
    background: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.background};
    border: 1px solid ${p => p.theme.tokens.border.primary};
  }
  &::after,
  > [data-toggle-card-face] {
    transform: translateY(calc(-1 * var(--card-lift)));
    transition: transform ${p => p.theme.motion.snap.fast};
  }
  > [data-toggle-card-face] {
    position: relative;
    z-index: 1;
    border-radius: inherit;
  }
  &[data-variant='checkbox'] {
    --card-indicator-radius: ${p => p.theme.radius.xs};
  }
  &:hover:not([aria-disabled='true']):not([data-checked='true']) {
    --card-lift: 3px;
  }
  &:active,
  &[data-checked='true'],
  &[aria-disabled='true'] {
    --card-lift: 0px;
  }
  &[data-checked='true'] {
    --card-chonk: ${p => p.theme.tokens.interactive.chonky.embossed.accent.chonk};
    --card-indicator-background: ${p => p.theme.tokens.interactive.chonky.debossed.accent.background};
    --card-indicator-border: ${p => p.theme.tokens.interactive.chonky.debossed.accent.chonk};
    &::after {
      border-color: ${p => p.theme.tokens.border.accent.vibrant};
      background-image: linear-gradient(
        ${p => p.theme.tokens.interactive.transparent.accent.selected.background.rest},
        ${p => p.theme.tokens.interactive.transparent.accent.selected.background.rest}
      );
    }
  }
  &[data-checked='true'][data-variant='radio'] {
    --card-radio-dot: 1;
  }
  &[data-checked='true'][data-variant='checkbox'] {
    --card-checkbox-mark: 1;
  }
  &[data-checked='true'][data-variant='checkbox']:hover:not(
      [aria-disabled='true']
    )::after {
    background-image: linear-gradient(
      ${p => p.theme.tokens.interactive.transparent.accent.selected.background.hover},
      ${p => p.theme.tokens.interactive.transparent.accent.selected.background.hover}
    );
  }
  &:has([data-toggle-card-input]:focus-visible),
  &:has([data-toggle-card-trigger]:focus-visible) {
    &::after {
      box-shadow:
        0 var(--card-lift) 0 0 var(--card-chonk),
        0 var(--card-lift) 0 2px ${p => p.theme.tokens.focus.default},
        0 0 0 2px ${p => p.theme.tokens.focus.default};
    }
  }
  &[aria-disabled='true'] {
    cursor: not-allowed;
  }
  &[aria-disabled='true']:not([data-checked='true']) {
    opacity: ${p => p.theme.tokens.interactive.disabled};
  }
  @media (prefers-reduced-motion: reduce) {
    &::after,
    > [data-toggle-card-face] {
      transition: none;
    }
  }
`;

const triggerStyles = ({theme}: {theme: Theme}) => css`
  appearance: none;
  display: block;
  flex: 1;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: ${theme.font.weight.sans.regular};
  text-align: left;
  cursor: inherit;
  outline: none;
`;
const LabelTrigger = styled('label')`
  ${triggerStyles}
  position: relative;
`;
const ButtonTrigger = styled('button')(triggerStyles);
const SelectionInput = styled('input')`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: inherit;
`;
const Indicator = styled(Flex)`
  position: relative;
  border: 1px solid var(--card-indicator-border);
  background: var(--card-indicator-background);
  border-radius: var(--card-indicator-radius);
  color: ${p => p.theme.tokens.content.onVibrant.light};
  > svg {
    opacity: var(--card-checkbox-mark);
  }
  &::after {
    content: '';
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: ${p => p.theme.radius.full};
    background: currentColor;
    opacity: var(--card-radio-dot);
  }
`;
