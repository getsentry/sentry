import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import type {DO_NOT_USE_CommonButtonProps} from 'sentry/components/core/button';
import {
  DO_NOT_USE_BUTTON_ICON_SIZES,
  DO_NOT_USE_getButtonStyles,
  useButtonFunctionality,
} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {space} from 'sentry/styles/space';

import {getChonkButtonStyles} from './index.chonk';

type LinkElementProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'label' | 'size' | 'title'
>;

export interface LinkButtonProps
  extends DO_NOT_USE_CommonButtonProps,
    Omit<LinkElementProps, 'role'> {
  /**
   * Determines if the link is disabled.
   */
  disabled?: boolean;
  /**
   * Determines if the link is external and should open in a new tab.
   */
  external?: boolean;
  href?: string;
  /**
   * If true, the link will not reset the scroll position of the page when clicked.
   */
  preventScrollReset?: boolean;
  /**
   * Determines if the link should replace the current history entry.
   */
  replace?: boolean;
  to?: string | LocationDescriptor;
}

export function LinkButton({
  size = 'md',
  to,
  href,
  disabled,
  tooltipProps,
  ...props
}: LinkButtonProps) {
  const {handleClick, hasChildren, accessibleLabel} = useButtonFunctionality({
    ...props,
    to,
    href,
    disabled,
  });

  return (
    <Tooltip skipWrapper {...tooltipProps} title={props.title} disabled={!props.title}>
      <StyledLinkButton
        aria-label={accessibleLabel}
        aria-disabled={disabled}
        size={size}
        href={disabled ? undefined : href}
        to={disabled ? undefined : to}
        disabled={disabled}
        {...props}
        onClick={handleClick}
      >
        {props.priority !== 'link' && (
          <InteractionStateLayer
            higherOpacity={
              props.priority && ['primary', 'danger'].includes(props.priority)
            }
          />
        )}
        <ButtonLabel size={size} borderless={props.borderless}>
          {props.icon && (
            <Icon size={size} hasChildren={hasChildren}>
              <IconDefaultsProvider size={DO_NOT_USE_BUTTON_ICON_SIZES[size]}>
                {props.icon}
              </IconDefaultsProvider>
            </Icon>
          )}
          {props.children}
        </ButtonLabel>
      </StyledLinkButton>
    </Tooltip>
  );
}

const StyledLinkButton = styled(
  ({size: _size, title: _title, external, ...props}: LinkButtonProps) => {
    if (props.to) {
      return <Link {...props} to={props.to} role="button" />;
    }

    if (props.href) {
      return (
        <a
          {...props}
          {...(external ? {target: '_blank', rel: 'noreferrer noopener'} : {})}
          role="button"
        />
      );
    }

    const {replace: _replace, preventScrollReset: _preventScrollReset, ...rest} = props;
    // @ts-expect-error we are spreading anchor link props on a button
    return <button {...rest} role="button" />;
  },
  {
    shouldForwardProp: prop =>
      prop === 'external' ||
      prop === 'replace' ||
      prop === 'preventScrollReset' ||
      (typeof prop === 'string' && isPropValid(prop)),
  }
)<LinkButtonProps>`
  ${p =>
    p.theme.isChonk
      ? getChonkButtonStyles(p as any)
      : DO_NOT_USE_getButtonStyles(p as any)}
`;

const ButtonLabel = styled('span', {
  shouldForwardProp: prop =>
    typeof prop === 'string' &&
    isPropValid(prop) &&
    !['size', 'borderless'].includes(prop),
})<Pick<LinkButtonProps, 'size' | 'borderless'>>`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
`;

const Icon = styled('span')<{hasChildren?: boolean; size?: LinkButtonProps['size']}>`
  display: flex;
  align-items: center;
  margin-right: ${p =>
    p.hasChildren
      ? p.size === 'xs' || p.size === 'zero'
        ? space(0.75)
        : space(1)
      : '0'};
  flex-shrink: 0;
`;
