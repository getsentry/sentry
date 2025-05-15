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
  'label' | 'size' | 'title' | 'href'
>;

interface BaseLinkButtonProps extends DO_NOT_USE_CommonButtonProps, LinkElementProps {
  /**
   * Determines if the link is disabled.
   */
  disabled?: boolean;
}

interface LinkButtonPropsWithHref extends BaseLinkButtonProps {
  href: string;
  /**
   * Determines if the link is external and should open in a new tab.
   */
  external?: boolean;
}

interface LinkButtonPropsWithTo extends BaseLinkButtonProps {
  to: string | LocationDescriptor;
  /**
   * If true, the link will not reset the scroll position of the page when clicked.
   */
  preventScrollReset?: boolean;
  /**
   * Determines if the link should replace the current history entry.
   */
  replace?: boolean;
}

export type LinkButtonProps = LinkButtonPropsWithHref | LinkButtonPropsWithTo;

export function LinkButton({
  size = 'md',
  disabled,
  tooltipProps,
  ...props
}: LinkButtonProps) {
  const {handleClick, hasChildren, accessibleLabel} = useButtonFunctionality({
    ...props,
    disabled,
  });

  return (
    <Tooltip skipWrapper {...tooltipProps} title={props.title} disabled={!props.title}>
      <StyledLinkButton
        aria-label={accessibleLabel}
        aria-disabled={disabled}
        size={size}
        {...props}
        // @ts-expect-error set href as undefined to force "disabled" state.
        href={disabled ? undefined : 'href' in props ? props.href : undefined}
        // @ts-expect-error set to as undefined to force "disabled" state
        to={disabled ? undefined : 'to' in props ? props.to : undefined}
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
  ({size: _size, title: _title, ...props}: LinkButtonProps) => {
    if ('to' in props && props.to) {
      return <Link {...props} to={props.to} role="button" />;
    }

    if ('href' in props && props.href) {
      const {external, ...rest} = props;
      return (
        <a
          {...rest}
          {...(external ? {target: '_blank', rel: 'noreferrer noopener'} : {})}
          role="button"
        />
      );
    }

    // @ts-expect-error these props cannot be statically determined at this point
    const {external: _e, replace: _r, preventScrollReset: _p, ...rest} = props;
    return <a {...rest} role="button" />;
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
