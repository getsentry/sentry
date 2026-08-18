import {getCopyEncryptedValueAction} from 'sentry/views/explore/components/traceItemAttributes/encryptedPiiContext';

const SEALED = 'c2VhbGVkLXBheWxvYWQ=';
const ENCRYPTED_META = {
  'user.email': {meta: {value: {'': {len: 0, rem: [['project:0', 'e', 0, 11]]}}}},
};

describe('getCopyEncryptedValueAction', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue('')},
    });
  });

  it('copies the sealed payload for an attribute marked encrypted by meta', () => {
    const action = getCopyEncryptedValueAction({
      attributeKey: 'user.email',
      value: '[Encrypted]',
      encryptedPii: SEALED,
      traceItemMeta: ENCRYPTED_META,
    });

    expect(action?.label).toBe('Copy encrypted value');

    action?.onAction?.();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SEALED);
  });

  it('falls back to the placeholder when the item carries no scrubbing meta', () => {
    expect(
      getCopyEncryptedValueAction({
        attributeKey: 'user.email',
        value: '[Encrypted]',
        encryptedPii: SEALED,
      })
    ).not.toBeNull();
  });

  it('returns null when the attribute was scrubbed rather than encrypted', () => {
    expect(
      getCopyEncryptedValueAction({
        attributeKey: 'user.email',
        value: '[Filtered]',
        encryptedPii: SEALED,
        traceItemMeta: {
          'user.email': {meta: {value: {'': {len: 0, rem: [['project:0', 's', 0, 10]]}}}},
        },
      })
    ).toBeNull();
  });

  it('returns null when the item has no sealed payload', () => {
    expect(
      getCopyEncryptedValueAction({
        attributeKey: 'user.email',
        value: '[Encrypted]',
        traceItemMeta: ENCRYPTED_META,
      })
    ).toBeNull();
  });
});
