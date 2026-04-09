import {useCallback} from 'react';
import {css} from '@emotion/react';
import type {LocationDescriptor} from 'history';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {CMDKActionData} from 'sentry/components/commandPalette/ui/cmdk';
import type {CollectionTreeNode} from 'sentry/components/commandPalette/ui/collection';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import {GlobalCommandPaletteActions} from 'sentry/components/commandPalette/ui/commandPaletteGlobalActions';
import {locationDescriptorToTo} from 'sentry/utils/reactRouter6Compat/location';
import type {Theme} from 'sentry/utils/theme';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';

function getLocationHref(to: LocationDescriptor): string {
  const resolved = locationDescriptorToTo(to);

  if (typeof resolved === 'string') {
    return resolved;
  }

  return `${resolved.pathname ?? ''}${resolved.search ?? ''}${resolved.hash ?? ''}`;
}

function isExternalLocation(to: LocationDescriptor): boolean {
  const currentUrl = new URL(window.location.href);
  const targetUrl = new URL(getLocationHref(to), currentUrl.href);
  return targetUrl.origin !== currentUrl.origin;
}

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
        action.onAction();
        // When the action has children, the palette will push into them so the
        // user can select a secondary action — keep the modal open.
        if (action.children.length > 0) {
          return;
        }
      }
      closeModal();
    },
    [navigate, closeModal]
  );

  return (
    <Body>
      <CommandPalette onAction={handleSelect}>
        <GlobalCommandPaletteActions />
      </CommandPalette>
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
