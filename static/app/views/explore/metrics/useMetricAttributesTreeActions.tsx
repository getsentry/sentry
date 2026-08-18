import type {AttributesTreeContent} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {getCopyEncryptedValueAction} from 'sentry/views/explore/components/traceItemAttributes/encryptedPiiContext';
import {useAttributeTreeSearchActions} from 'sentry/views/explore/components/traceItemAttributes/useAttributeTreeSearchActions';
import type {TraceItemDetailsMeta} from 'sentry/views/explore/hooks/useTraceItemDetails';

export function useMetricAttributesTreeActions({
  encryptedPii,
  traceItemMeta,
}: {
  /**
   * The sample's sealed PII payload, if any of its attributes were encrypted rather than scrubbed.
   */
  encryptedPii?: string;
  traceItemMeta?: TraceItemDetailsMeta;
} = {}) {
  const getSearchActions = useAttributeTreeSearchActions();

  return (content: AttributesTreeContent) => {
    const items = getSearchActions(content);
    const attributeKey = content.originalAttribute?.original_attribute_key;

    if (attributeKey) {
      const encryptedValueAction = getCopyEncryptedValueAction({
        attributeKey,
        value: content.value,
        encryptedPii,
        traceItemMeta,
      });
      if (encryptedValueAction) {
        items.push(encryptedValueAction);
      }
    }

    return items;
  };
}
