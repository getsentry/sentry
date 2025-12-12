import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconClose} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import * as ChonkTag from './tag.chonk';

type TagType =
  // @TODO(jonasbadalic): "default" is a bad API naming
  'default' | 'info' | 'success' | 'warning' | 'danger' | 'promotion';

/**
 * @deprecated Do not use these tag types
 */
type DeprecatedTagType = 'white' | 'black';

const legacyMapping: Record<string, TagType> = {
  highlight: 'info',
  error: 'danger',
  white: 'default',
  black: 'default',
};

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Icon on the left side.
   */
  icon?: React.ReactNode;
  /**
   * Shows clickable IconClose on the right side.
   */
  onDismiss?: () => void;
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Dictates color scheme of the tag.
   */
  type?: TagType | DeprecatedTagType;
}

export function Tag({
  ref,
  type = 'default',
  icon,
  onDismiss,
  children,
  ...props
}: TagProps) {
  return (
    <StyledTag
      type={(type && legacyMapping[type]) ?? (type as TagType)}
      data-test-id="tag-background"
      ref={ref}
      {...props}
    >
      {icon && (
        <IconWrapper>
          <IconDefaultsProvider size="xs">{icon}</IconDefaultsProvider>
        </IconWrapper>
      )}

      {/* @TODO(jonasbadalic): Can, and should we make children required? */}
      {children && <Text>{children}</Text>}

      {onDismiss && (
        <DismissButton
          onClick={event => {
            event.preventDefault();
            onDismiss?.();
          }}
          size="zero"
          priority="link"
          borderless
          aria-label={t('Dismiss')}
          icon={<IconClose size="xs" />}
        />
      )}
    </StyledTag>
  );
}

const StyledTag = ChonkTag.TagPill;

const Text = styled('div')`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  /* @TODO(jonasbadalic): Some occurrences pass other things than strings into the children prop. */
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const IconWrapper = styled('span')`
  margin-right: ${space(0.5)};
  display: inline-flex;
  align-items: center;
  gap: inherit;
`;

const DismissButton = styled(Button)`
  margin-left: ${space(0.5)};
  margin-right: -${space(0.5)};
  border: none;
`;
