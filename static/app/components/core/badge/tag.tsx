import {forwardRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {withChonk} from 'sentry/utils/theme/withChonk';

import * as ChonkTag from './tag.chonk';

type TagType =
  // @TODO(jonasbadalic): "default" is a bad API naming
  'default' | 'info' | 'success' | 'warning' | 'error' | 'promotion' | 'highlight';

/**
 * @deprecated Do not use these tag types
 */
type DeprecatedTagType = 'white' | 'black';

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
  type?: TagType | DeprecatedTagType;
}

export const Tag = forwardRef<HTMLDivElement, TagProps>(
  ({type = 'default', icon, onDismiss, children, ...props}: TagProps, ref) => {
    return (
      <StyledTag type={type} data-test-id="tag-background" ref={ref} {...props}>
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
            icon={<IconClose isCircled size="xs" />}
          />
        )}
      </StyledTag>
    );
  }
);

const TagPill = styled('div')<{
  type: TagType;
}>`
  font-size: ${p => p.theme.fontSizeSmall};
  background-color: ${p => p.theme.tag[p.type].background};
  border: solid 1px ${p => p.theme.tag[p.type].border};
  display: inline-flex;
  align-items: center;
  height: 20px;
  border-radius: 20px;
  padding: 0 ${space(1)};
  max-width: 166px;

  color: ${p => p.theme.tag[p.type].color};
  /* @TODO(jonasbadalic): We need to override button colors because they wrongly default to a blue color... */
  button,
  button:hover {
    color: currentColor;
  }
`;

const StyledTag = withChonk(TagPill, ChonkTag.TagPill, ChonkTag.chonkTagPropMapping);

const Text = styled('div')`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  /* @TODO(jonasbadalic): Some occurrences pass other things than strings into the children prop. */
  display: flex;
  align-items: center;
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
