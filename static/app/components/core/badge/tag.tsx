import {forwardRef, useCallback} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Color} from 'sentry/utils/theme';

type TagType =
  // @TODO(jonasbadalic): "default" is a bad API naming
  | 'default'
  | 'promotion'
  | 'highlight'
  | 'warning'
  | 'success'
  | 'error'
  | 'info'
  | 'white'
  | 'black';
export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Icon on the left side.
   */
  icon?: React.ReactNode;
  /**
   * Shows clickable IconClose on the right side.
   */
  onDismiss?: () => void;
  /**
   * Max width of the tag's text
   */
  textMaxWidth?: number;
  /**
   * Dictates color scheme of the tag.
   */
  type?: TagType;
}

const BaseTag = forwardRef<HTMLSpanElement, TagProps>(
  (
    {type = 'default', icon, onDismiss, children, textMaxWidth = 150, ...props}: TagProps,
    ref
  ) => {
    const theme = useTheme();

    const handleDismiss = useCallback<React.MouseEventHandler>(
      event => {
        event.preventDefault();
        onDismiss?.();
      },
      [onDismiss]
    );

    const iconsProps: SVGIconProps = {
      size: 'xs',
      color: theme.tag[type].color as Color,
    };

    return (
      <span {...props} ref={ref}>
        {/* <Tooltip
        containerDisplayMode="inline-flex"
        title={tooltipProps?.title}
        {...tooltipProps}
      > */}
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
        {/* </Tooltip> */}
      </span>
    );
  }
);

const StyledTag = styled(BaseTag)`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Background = styled('div')<{
  type: keyof Theme['tag'];
}>`
  display: inline-flex;
  align-items: center;
  height: 20px;
  border-radius: 20px;
  background-color: ${p => p.theme.tag[p.type].background};
  border: solid 1px ${p => p.theme.tag[p.type].border};
  padding: 0 ${space(1)};
`;

export const Tag = Object.assign(StyledTag, {
  Background,
});

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
  line-height: 20px;
`;

const DismissButton = styled(Button)`
  margin-left: ${space(0.5)};
  margin-right: -${space(0.5)};
  border: none;
`;
