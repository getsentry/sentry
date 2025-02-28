import {forwardRef, useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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
   * Dictates color scheme of the tag.
   */
  type?: TagType;
}

export const Tag = forwardRef<HTMLDivElement, TagProps>(
  ({type = 'default', icon, onDismiss, children, ...props}: TagProps, ref) => {
    const handleDismiss = useCallback<React.MouseEventHandler>(
      event => {
        event.preventDefault();
        onDismiss?.();
      },
      [onDismiss]
    );

    return (
      <StyledTag type={type} data-test-id="tag-background" ref={ref} {...props}>
        {icon && (
          <IconWrapper>
            <IconDefaultsProvider size="xs">{icon}</IconDefaultsProvider>
          </IconWrapper>
        )}

        <Text>{children}</Text>

        {onDismiss && (
          <DismissButton
            onClick={handleDismiss}
            size="zero"
            priority="link"
            aria-label={t('Dismiss')}
            icon={<IconClose isCircled size="xs" />}
          />
        )}
      </StyledTag>
    );
  }
);

const StyledTag = styled('div')<{
  type: TagType;
}>`
  font-size: ${p => p.theme.fontSizeSmall};
  background-color: ${p => p.theme.tag[p.type].background};
  border: solid 1px ${p => p.theme.tag[p.type].border};
  color: ${p => p.theme.tag[p.type].color};
  display: inline-flex;
  align-items: center;
  height: 20px;
  border-radius: 20px;
  padding: 0 ${space(1)};
  max-width: 166px;
`;

const Text = styled('div')`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const IconWrapper = styled('span')`
  margin-right: ${space(0.5)};
  display: inline-flex;
`;

const DismissButton = styled(Button)`
  margin-left: ${space(0.5)};
  margin-right: -${space(0.5)};
  border: none;
`;
