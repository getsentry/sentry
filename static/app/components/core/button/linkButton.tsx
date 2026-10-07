import isPropValid from '@emotion/is-prop-valid';
import type {LocationDescriptor} from 'history';
import type {DistributedOmit} from 'type-fest';

import {Flex, useResponsivePropValue} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {useSizeContext} from '@sentry/scraps/sizeContext';
import {Tooltip} from '@sentry/scraps/tooltip';
import {useClickTracking} from '@sentry/scraps/trackingContext';

import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';

import {DO_NOT_USE_BUTTON_ICON_SIZES as BUTTON_ICON_SIZES} from './styles';
import {
  getButtonContentStyleProps,
  getButtonStyleProps,
  getButtonStyleState,
} from './stylexStyles';
import type {ButtonSize, DO_NOT_USE_LinkButtonProps as LinkButtonProps} from './types';
import {useButtonFunctionality} from './useButtonFunctionality';

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
  const styleState = getButtonStyleState(
    {...props, 'aria-disabled': disabled, disabled},
    size,
    hasChildren
  );

  return (
    <Tooltip
      skipWrapper
      {...tooltipProps}
      title={tooltipProps?.title}
      disabled={!tooltipProps?.title}
    >
      <LinkButtonElement
        aria-label={accessibleLabel}
        aria-disabled={disabled}
        disabled={disabled}
        size={size}
        {...props}
        styleState={styleState}
        href={disabled ? undefined : 'href' in props ? props.href : undefined}
        to={
          disabled
            ? // Disabled links are just text - this should have never been supported in the first place.
              // We cast it to the correct value to avoid a rightfully raised type error.
              (undefined as unknown as LocationDescriptor)
            : 'to' in props
              ? props.to
              : // Disabled links are just text - this should have never been supported in the first place.
                // We cast it to the correct value to avoid a rightfully raised type error.
                (undefined as unknown as LocationDescriptor)
        }
      >
        <span {...getButtonContentStyleProps(styleState, {hideWhenBusy: false})}>
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
        </span>
      </LinkButtonElement>
    </Tooltip>
  );
}

// The props the Emotion version forwarded to the element besides DOM attributes.
const FORWARDED_PROPS: ReadonlySet<string> = new Set([
  'analyticsEventKey',
  'analyticsEventName',
  'analyticsParams',
  'busy',
  'external',
  'replace',
  'preventScrollReset',
  'openInNewTab',
  'variant',
]);

function LinkButtonElement({
  size: _size,
  styleState,
  ...allProps
}: ResolvedLinkButtonProps & {
  styleState: ReturnType<typeof getButtonStyleState>;
}) {
  const props: Record<string, any> = {};
  for (const key in allProps) {
    if (FORWARDED_PROPS.has(key) || isPropValid(key)) {
      props[key] = (allProps as Record<string, any>)[key];
    }
  }
  const sx = getButtonStyleProps(styleState);
  props.className = props.className ? `${sx.className} ${props.className}` : sx.className;
  props.style = sx.style ? {...sx.style, ...props.style} : props.style;
  const {handleClick} = useClickTracking(props as LinkButtonProps, 'link');

  if ('to' in props && props.to) {
    const {openInNewTab, ...linkProps} = props;
    return (
      <Link
        {...(linkProps as ResolvedLinkButtonProps & {to: LocationDescriptor})}
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
  } = props;
  return <a {...rest} onClick={handleClick} role="button" />;
}
