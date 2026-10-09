import {useState} from 'react';
import styled from '@emotion/styled';
import {IconEllipsis} from '@sentry/icons/ellipsis';

import {type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {TreeValueDropdown as KeyValueTreeValueDropdown} from 'sentry/components/keyValueTree/styles';
import type {KeyValueTreeValue} from 'sentry/components/keyValueTree/utils';
import {t} from 'sentry/locale';
import {isValidUrl} from 'sentry/utils/string/isValidUrl';

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
  usePortal,
}: {
  ariaLabel: string;
  items: MenuItemProps[];
  usePortal?: boolean;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <RevealOnHover.Action visible={isMenuOpen}>
      <TreeValueDropdown
        usePortal={usePortal}
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
