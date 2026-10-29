import {IconDefaultsProvider} from '@sentry/icons/useIconDefaults';
import type {DistributedOmit} from 'type-fest';

import {Flex, useResponsivePropValue} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {LinkBase} from '@sentry/scraps/link/link';
import {useSizeContext} from '@sentry/scraps/sizeContext';
import {Tooltip} from '@sentry/scraps/tooltip';
import {useClickTracking} from '@sentry/scraps/trackingContext';

import {DO_NOT_USE_BUTTON_ICON_SIZES as BUTTON_ICON_SIZES} from './styles';
import type {ButtonSize, DO_NOT_USE_LinkButtonProps as LinkButtonProps} from './types';
import {useButtonFunctionality} from './useButtonFunctionality';
import {YakButton} from './yakStyles';

export type {LinkButtonProps};

type ResolvedLinkButtonProps = DistributedOmit<LinkButtonProps, 'size'> & {
  size: ButtonSize;
};

export function LinkButton({
  disabled,
  tooltipProps,
  size: explicitSize,
  ...props
}: LinkButtonProps) {
  const contextSize = useSizeContext();
  const size = useResponsivePropValue(explicitSize ?? contextSize ?? 'md');
  const {hasChildren, accessibleLabel} = useButtonFunctionality({
    ...props,
    disabled,
  });

  return (
    <Tooltip
      skipWrapper
      {...tooltipProps}
      title={tooltipProps?.title}
      disabled={!tooltipProps?.title}
    >
      <YakButton
        as={LinkButtonElement}
        aria-label={accessibleLabel}
        aria-disabled={disabled}
        disabled={disabled}
        size={size}
        {...props}
        shapeVariant={hasChildren ? 'rectangular' : 'square'}
        href={disabled ? undefined : 'href' in props ? props.href : undefined}
        to={
          disabled
            ? // Disabled links are just text - this should have never been supported in the first place.
              // We cast it to the correct value to avoid a rightfully raised type error.
              (undefined as unknown as LinkProps['to'])
            : 'to' in props
              ? props.to
              : // Disabled links are just text - this should have never been supported in the first place.
                // We cast it to the correct value to avoid a rightfully raised type error.
                (undefined as unknown as LinkProps['to'])
        }
      >
        <Flex
          as="span"
          align="center"
          justify="center"
          minWidth="0"
          height="100%"
          whiteSpace="nowrap"
        >
          {props.icon && (
            <Flex
              as="span"
              align="center"
              flexShrink={0}
              marginRight={
                hasChildren ? (size === 'xs' || size === 'zero' ? 'sm' : 'md') : undefined
              }
            >
              <IconDefaultsProvider size={BUTTON_ICON_SIZES[size]}>
                {props.icon}
              </IconDefaultsProvider>
            </Flex>
          )}
          {props.children}
        </Flex>
      </YakButton>
    </Tooltip>
  );
}

function LinkButtonElement({
  size: _size,
  shapeVariant: _shapeVariant,
  ...props
}: ResolvedLinkButtonProps & {shapeVariant: 'rectangular' | 'square'}) {
  const {handleClick} = useClickTracking(props, 'link');

  if ('to' in props && props.to) {
    const {openInNewTab, ...linkProps} = props;
    return (
      <LinkBase
        {...linkProps}
        to={props.to}
        role="button"
        {...(openInNewTab ? {target: '_blank', rel: 'noreferrer noopener'} : {})}
      />
    );
  }

  if ('href' in props && props.href) {
    const {
      external,
      analyticsEventKey: _analyticsEventKey,
      analyticsEventName: _analyticsEventName,
      analyticsParams: _analyticsParams,
      busy: _busy,
      variant: _variant,
      ...rest
    } = props;
    return (
      <a
        {...rest}
        onClick={handleClick}
        {...(external ? {target: '_blank', rel: 'noreferrer noopener'} : {})}
        role="button"
      />
    );
  }

  const {
    external: _e,
    replace: _r,
    preventScrollReset: _p,
    openInNewTab: _o,
    analyticsEventKey: _analyticsEventKey,
    analyticsEventName: _analyticsEventName,
    analyticsParams: _analyticsParams,
    busy: _busy,
    variant: _variant,
    ...rest
    // cast because props cannot be statically determined at this point
  } = props as any;
  return <a {...rest} onClick={handleClick} role="button" />;
}
