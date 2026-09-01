import {ATTRIBUTE_SEARCH_METADATA, type AttributeValue} from '@sentry/conventions';

const TYPED_TAG_KEY_RE = /tags\[(\S*),(\S*)\]/;
const ATTRIBUTE_DEPRECATION_CHAIN_BY_KEY = new Map<
  string,
  readonly string[] | undefined
>();

type AttributeValueByKind = {
  boolean: boolean;
  'boolean[]': boolean[];
  number: number;
  'number[]': number[];
  string: string;
  'string[]': string[];
};

type AttributeValueKind = keyof AttributeValueByKind;

function isAttributeValue(value: unknown): value is AttributeValue {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    (Array.isArray(value) &&
      (value.every(item => typeof item === 'string') ||
        value.every(item => typeof item === 'number') ||
        value.every(item => typeof item === 'boolean')))
  );
}

function isAttributeValueOfKind<K extends AttributeValueKind>(
  value: unknown,
  kind: K
): value is AttributeValueByKind[K] {
  switch (kind) {
    case 'string':
    case 'number':
    case 'boolean':
      return typeof value === kind;
    case 'string[]':
      return Array.isArray(value) && value.every(item => typeof item === 'string');
    case 'number[]':
      return Array.isArray(value) && value.every(item => typeof item === 'number');
    case 'boolean[]':
      return Array.isArray(value) && value.every(item => typeof item === 'boolean');
    default:
      return false;
  }
}

function getAttributeValueFromDeprecationChain(
  attributes: Record<string, unknown>,
  deprecationChain: readonly string[],
  kind?: AttributeValueKind
): AttributeValue | undefined {
  for (const candidateKey of deprecationChain) {
    if (Object.hasOwn(attributes, candidateKey)) {
      const value = attributes[candidateKey];
      return isAttributeValue(value) &&
        (kind === undefined || isAttributeValueOfKind(value, kind))
        ? value
        : undefined;
    }
  }

  return undefined;
}

export function getAttributeValue<K extends AttributeValueKind>(
  attributes: unknown,
  key: string,
  kind: K
): AttributeValueByKind[K] | undefined;
export function getAttributeValue(
  attributes: unknown,
  key: string
): AttributeValue | undefined;
export function getAttributeValue(
  attributes: unknown,
  key: string,
  kind?: AttributeValueKind
): AttributeValue | undefined {
  if (typeof attributes !== 'object' || attributes === null) {
    return undefined;
  }

  const prettifiedKey = key.match(TYPED_TAG_KEY_RE)?.[1] ?? key;
  const deprecationChain = ATTRIBUTE_DEPRECATION_CHAIN_BY_KEY.get(prettifiedKey);
  if (ATTRIBUTE_DEPRECATION_CHAIN_BY_KEY.has(prettifiedKey)) {
    if (!deprecationChain) {
      return undefined;
    }

    return getAttributeValueFromDeprecationChain(
      attributes as Record<string, unknown>,
      deprecationChain,
      kind
    );
  }

  const metadata =
    ATTRIBUTE_SEARCH_METADATA[prettifiedKey] ??
    Object.values(ATTRIBUTE_SEARCH_METADATA).find(({deprecationChain: chain}) =>
      chain.includes(prettifiedKey)
    );

  ATTRIBUTE_DEPRECATION_CHAIN_BY_KEY.set(prettifiedKey, metadata?.deprecationChain);

  if (!metadata) {
    return undefined;
  }

  return getAttributeValueFromDeprecationChain(
    attributes as Record<string, unknown>,
    metadata.deprecationChain,
    kind
  );
}
