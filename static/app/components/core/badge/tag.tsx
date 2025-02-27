import {useCallback} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import type {TooltipProps} from 'sentry/components/tooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClose} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Color} from 'sentry/utils/theme';

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Makes the tag clickable. Use for external links.
   * If no icon is passed, it defaults to IconOpen (can be removed by passing icon={null})
   */
  // href?: string;
  /**
   * Icon on the left side.
   */
  icon?: NonNullable<React.ReactNode>;
  /**
   * Shows clickable IconClose on the right side.
   */
  onDismiss?: () => void;
  /**
   * Max width of the tag's text
   */
  textMaxWidth?: number;
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
  onDismiss,
  children,
  textMaxWidth = 150,
  ...props
}: TagProps) {
  const theme = useTheme();
  const iconsProps: SVGIconProps = {
    size: 'xs',
    color: theme.tag[type].color as Color,
  };

  const handleDismiss = useCallback<React.MouseEventHandler>(
    event => {
      event.preventDefault();
      onDismiss?.();
    },
    [onDismiss]
  );

  return (
    <span {...props}>
      <Tooltip title={tooltipText} containerDisplayMode="inline-flex" {...tooltipProps}>
        <Background type={type} data-test-id="tag-background">
          {icon && (
            <IconWrapper>
              <IconDefaultsProvider {...iconsProps}>{icon}</IconDefaultsProvider>
            </IconWrapper>
          )}

          <Text type={type} maxWidth={textMaxWidth}>
            {children}
          </Text>

          {onDismiss && (
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
    </span>
  );
}

export const Tag = styled(BaseTag)`
  font-size: ${p => p.theme.fontSizeSmall};
`;
export default Tag;

const TAG_HEIGHT = '20px';

export const Background = styled('div')<{
  type: keyof Theme['tag'];
}>`
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
  color: ${p => p.theme.tag[p.type].color};
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
