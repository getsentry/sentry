import {useCallback} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {CMDKActionData} from 'sentry/components/commandPalette/ui/cmdk';
import type {CollectionTreeNode} from 'sentry/components/commandPalette/ui/collection';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import {
  getLocationHref,
  isExternalLocation,
} from 'sentry/components/commandPalette/ui/locationUtils';
import type {Theme} from 'sentry/utils/theme';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';

export default function CommandPaletteModal({Body, closeModal}: ModalRenderProps) {
  const navigate = useNavigate();

  const handleSelect = useCallback(
    (
      action: CollectionTreeNode<CMDKActionData>,
      options?: {modifierKeys?: {shiftKey: boolean}}
    ) => {
      if ('to' in action) {
        const normalizedTo = normalizeUrl(action.to);
        if (isExternalLocation(normalizedTo) || options?.modifierKeys?.shiftKey) {
          window.open(getLocationHref(normalizedTo), '_blank', 'noreferrer');
        } else {
          navigate(normalizedTo);
        }
      } else if ('onAction' in action) {
        // When the action has children, the palette will push into them so the
        // user can select a secondary action — keep the modal open. The
        // callback already ran when the palette delegated this selection.
        if (action.children.length > 0) {
          return;
        }
        action.onAction();
      }
      closeModal();
    },
    [navigate, closeModal]
  );

  return (
    <Body>
      <CommandPalette onAction={handleSelect} />
    </Body>
  );
}

export const modalCss = (theme: Theme) => {
  return css`
    [role='document'] {
      padding: 0;

      background-color: ${theme.tokens.background.primary};
      border-top-left-radius: calc(${theme.radius.lg} + 1px);
      border-top-right-radius: calc(${theme.radius.lg} + 1px);
    }
  `;
};
