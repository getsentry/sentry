import {useCallback} from 'react';
import {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import Link, {LinkProps} from 'sentry/components/links/link';
import {Tooltip, TooltipProps} from 'sentry/components/tooltip';
import {IconClose, IconOpen} from 'sentry/icons';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import theme, {Color} from 'sentry/utils/theme';

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Makes the tag clickable. Use for external links.
   * If no icon is passed, it defaults to IconOpen (can be removed by passing icon={null})
   */
  href?: string;
  /**
   * Icon on the left side.
   */
  icon?: React.ReactNode;
  /**
   * Triggered when the item is clicked
   */
  onClick?: (eventKey: any) => void;
  /**
   * Shows clickable IconClose on the right side.
   */
  onDismiss?: () => void;
  /**
   * Max width of the tag's text
   */
  textMaxWidth?: number;
  /**
   * Makes the tag clickable. Use for internal links handled by react router.
   * If no icon is passed, it defaults to IconOpen (can be removed by passing icon={null})
   */
  to?: LinkProps['to'];
  /**
   * Additional properites for the Tooltip when `tooltipText` is set.
   */
  tooltipProps?: Omit<TooltipProps, 'children' | 'title' | 'skipWrapper'>;
  /**
   * Text to show up on a hover.
   */
  tooltipText?: TooltipProps['title'];
  /**
   * Dictates color scheme of the tag.
   */
  type?: keyof Theme['tag'];
}

function BaseTag({
  type = 'default',
  icon,
  tooltipText,
  tooltipProps,
  to,
  onClick,
  href,
  onDismiss,
  children,
  textMaxWidth = 150,
  ...props
}: Props) {
  const iconsProps: SVGIconProps = {
    size: 'xs',
    color: theme.tag[type].iconColor as Color,
  };

  const isLink = href !== undefined || to !== undefined;

  // Links use the IconOpen by default
  const linkIcon = isLink ? <IconOpen /> : null;
  const tagIcon = icon || icon === null ? icon : linkIcon;

  const handleDismiss = useCallback<React.MouseEventHandler>(
    event => {
      event.preventDefault();
      onDismiss?.();
    },
    [onDismiss]
  );

  const trackClickEvent = useCallback(() => {
    trackAnalytics('tag.clicked', {
      is_clickable: onClick !== undefined || isLink,
      organization: null,
    });
  }, [isLink, onClick]);

  const tag = (
    <Tooltip title={tooltipText} containerDisplayMode="inline-flex" {...tooltipProps}>
      <Background type={type}>
        {tagIcon && (
          <IconWrapper>
            <IconDefaultsProvider {...iconsProps}>{tagIcon}</IconDefaultsProvider>
          </IconWrapper>
        )}

        <Text type={type} maxWidth={textMaxWidth}>
          {children}
        </Text>

        {onDismiss !== undefined && (
          <DismissButton
            onClick={handleDismiss}
            size="zero"
            priority="link"
            aria-label={t('Dismiss')}
            icon={<IconClose isCircled {...iconsProps} />}
          />
        )}
      </Background>
    </Tooltip>
  );

  const tagWithParent =
    href !== undefined ? (
      <ExternalLink href={href}>{tag}</ExternalLink>
    ) : to !== undefined ? (
      <Link to={to} onClick={onClick}>
        {tag}
      </Link>
    ) : (
      tag
    );

  return (
    <span {...props} onClick={trackClickEvent}>
      {tagWithParent}
    </span>
  );
}

const Tag = styled(BaseTag)`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TAG_HEIGHT = '20px';

export const Background = styled('div')<{type: keyof Theme['tag']}>`
  display: inline-flex;
  align-items: center;
  height: ${TAG_HEIGHT};
  border-radius: ${TAG_HEIGHT};
  background-color: ${p => p.theme.tag[p.type].background};
  border: solid 1px ${p => p.theme.tag[p.type].border};
  padding: 0 ${space(1)};
`;

const IconWrapper = styled('span')`
  margin-right: ${space(0.5)};
  display: inline-flex;
`;

const Text = styled('span')<{maxWidth: number; type: keyof Theme['tag']}>`
  color: ${p =>
    ['black', 'white'].includes(p.type)
      ? p.theme.tag[p.type].iconColor
      : p.theme.textColor};
  max-width: ${p => p.maxWidth}px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  line-height: ${TAG_HEIGHT};
`;

const DismissButton = styled(Button)`
  margin-left: ${space(0.5)};
  margin-right: -${space(0.5)};
  border: none;
`;

export default Tag;
