import {createContext, useContext, useMemo} from 'react';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {
  getEncryptedPii,
  isEncryptedAttribute,
} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {
  TraceItemDetailsMeta,
  TraceItemResponseAttribute,
} from 'sentry/views/explore/hooks/useTraceItemDetails';

interface EncryptedPiiContextValue {
  /**
   * The item's sealed PII payload, if it has one. Every encrypted attribute on an item is sealed
   * into this single blob, so every encrypted row offers the same ciphertext.
   */
  encryptedPii?: string;
  traceItemMeta?: TraceItemDetailsMeta;
}

const encryptedPiiContext = createContext<EncryptedPiiContextValue>({});

/**
 * Makes a trace item's sealed PII payload available to everything rendered for that item.
 *
 * The alternative is threading the payload and the scrubbing meta through every section, row and
 * renderer that might display an encrypted value, which is a lot of surface for something almost
 * every item does not have.
 */
export function EncryptedPiiProvider({
  attributes,
  traceItemMeta,
  children,
}: {
  children: React.ReactNode;
  attributes?: TraceItemResponseAttribute[];
  traceItemMeta?: TraceItemDetailsMeta;
}) {
  const value = useMemo(
    () => ({
      encryptedPii: attributes ? getEncryptedPii(attributes) : undefined,
      traceItemMeta,
    }),
    [attributes, traceItemMeta]
  );

  return (
    <encryptedPiiContext.Provider value={value}>{children}</encryptedPiiContext.Provider>
  );
}

export function useEncryptedPii(): EncryptedPiiContextValue {
  return useContext(encryptedPiiContext);
}

/**
 * The "Copy encrypted value" menu item for an attribute, or `null` when the value was not
 * encrypted or the item carries no sealed payload to copy.
 */
export function getCopyEncryptedValueAction({
  attributeKey,
  value,
  encryptedPii,
  traceItemMeta,
}: {
  attributeKey: string;
  value: string | number | null;
  encryptedPii?: string;
  traceItemMeta?: TraceItemDetailsMeta;
}): MenuItemProps | null {
  if (!encryptedPii || !isEncryptedAttribute({attributeKey, value, traceItemMeta})) {
    return null;
  }

  return {
    key: 'copy-encrypted-value',
    label: t('Copy encrypted value'),
    details: t(
      'Sealed with the public key configured for this organization. Only the matching private key can read it back.'
    ),
    onAction: () =>
      copyToClipboard(encryptedPii, {
        successMessage: t('Encrypted value copied to clipboard'),
      }),
  };
}

/**
 * Same as [getCopyEncryptedValueAction], reading the sealed payload from context.
 */
export function useCopyEncryptedValueAction() {
  const {encryptedPii, traceItemMeta} = useEncryptedPii();

  return ({
    attributeKey,
    value,
  }: {
    attributeKey: string;
    value: string | number | null;
  }): MenuItemProps | null =>
    getCopyEncryptedValueAction({attributeKey, value, encryptedPii, traceItemMeta});
}
