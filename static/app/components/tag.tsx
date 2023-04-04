import {cloneElement, isValidElement} from 'react';
import {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import Link, {LinkProps} from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClose, IconOpen} from 'sentry/icons';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import theme, {Color} from 'sentry/utils/theme';

const TAG_HEIGHT = '20px';

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
   * Text to show up on a hover.
   */
  tooltipText?: React.ComponentProps<typeof Tooltip>['title'];
  /**
   * Dictates color scheme of the tag.
   */
  type?: keyof Theme['tag'];
}

const Tag = ({
  type = 'default',
  icon,
  tooltipText,
  to,
  onClick,
  href,
  onDismiss,
  children,
  textMaxWidth = 150,
  ...props
}: Props) => {
  const iconsProps: SVGIconProps = {
    size: 'xs',
    color: theme.tag[type].iconColor as Color,
  };

  const tag = (
    <Tooltip title={tooltipText} containerDisplayMode="inline-flex">
      <Background type={type}>
        {tagIcon()}

        <Text type={type} maxWidth={textMaxWidth}>
          {children}
        </Text>

        {defined(onDismiss) && (
          <DismissButton
            onClick={handleDismiss}
            size="zero"
            priority="link"
            aria-label={t('Dismiss')}
          >
            <IconClose isCircled {...iconsProps} />
          </DismissButton>
        )}
      </Background>
    </Tooltip>
  );

  function handleDismiss(event: React.MouseEvent) {
    event.preventDefault();
    onDismiss?.();
  }

  const trackClickEvent = () => {
    trackAdvancedAnalyticsEvent('tag.clicked', {
      is_clickable: defined(onClick) || defined(to) || defined(href),
      organization: null,
    });
  };

  function tagIcon() {
    if (isValidElement(icon)) {
      return <IconWrapper>{cloneElement(icon, {...iconsProps})}</IconWrapper>;
    }

    if ((defined(href) || defined(to)) && icon === undefined) {
      return (
        <IconWrapper>
          <IconOpen {...iconsProps} />
        </IconWrapper>
      );
    }

    return null;
  }

  function tagWithParent() {
    if (defined(href)) {
      return <ExternalLink href={href}>{tag}</ExternalLink>;
    }

    if (defined(to) && defined(onClick)) {
      return (
        <Link to={to} onClick={onClick}>
          {tag}
        </Link>
      );
    }
    if (defined(to)) {
      return <Link to={to}>{tag}</Link>;
    }

    return tag;
  }

  return (
    <TagWrapper {...props} onClick={trackClickEvent}>
      {tagWithParent()}
    </TagWrapper>
  );
};

const TagWrapper = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
`;

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
  border: none;
`;

export default Tag;
