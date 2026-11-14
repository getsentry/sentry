import {useContext, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {IconEllipsis} from '@sentry/icons/ellipsis';

import {type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';
import {TooltipContext} from '@sentry/scraps/tooltip';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {isValidUrl} from 'sentry/utils/string/isValidUrl';

import {TreeValueDropdown as KeyValueTreeValueDropdown} from './styles';
import type {KeyValueTreeValue} from './utils';

const TREE_VALUE_DROPDOWN_BUTTON_CLASS = 'tree-value-dropdown-button';

export function visitExternalLinkAction(value: KeyValueTreeValue): MenuItemProps {
  const linkText = String(value);
  return {
    key: 'external-link',
    label: t('Visit this external link'),
    hidden: !isValidUrl(linkText),
    onAction: () => openNavigateToExternalLinkModal({linkText}),
  };
}

export function KeyValueTreeRowActions({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: MenuItemProps[];
}) {
  const theme = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const {container} = useContext(TooltipContext);

  return (
    <RevealOnHover.Action visible={isMenuOpen}>
      <TreeValueDropdown
        // Inline, the menu is clipped by scroll containers and trapped in the focused row's stacking context.
        usePortal
        // Drawers and modals sit above the dropdown z-index, so join their container and layer.
        portalContainerRef={{current: container}}
        zIndex={container ? theme.zIndex.modal : undefined}
        preventOverflowOptions={{padding: 4}}
        position="bottom-end"
        size="xs"
        isOpen={isMenuOpen}
        onOpenChange={setIsMenuOpen}
        trigger={triggerProps => (
          <OverlayTrigger.IconButton
            {...triggerProps}
            aria-label={ariaLabel}
            icon={<IconEllipsis />}
            className={TREE_VALUE_DROPDOWN_BUTTON_CLASS}
          />
        )}
        items={items}
      />
    </RevealOnHover.Action>
  );
}

const TreeValueDropdown = styled(KeyValueTreeValueDropdown)`
  .${TREE_VALUE_DROPDOWN_BUTTON_CLASS} {
    height: 20px;
    min-height: 20px;
    padding: 0 ${p => p.theme.space.sm};
    border-radius: ${p => p.theme.space.xs};
    z-index: 1;
  }
`;
