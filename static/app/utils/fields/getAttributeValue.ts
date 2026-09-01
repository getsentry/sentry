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

type AttributeEntry = {
  name: string;
  value: unknown;
};

type AttributeSource = Record<string, unknown> | unknown[];

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

function isAttributeEntry(attribute: unknown): attribute is AttributeEntry {
  return (
    typeof attribute === 'object' &&
    attribute !== null &&
    'name' in attribute &&
    typeof attribute.name === 'string' &&
    'value' in attribute
  );
}

function prettifyAttributeName(name: string): string {
  const prettifiedName = name.match(TYPED_TAG_KEY_RE)?.[1] ?? name;
  return prettifiedName.replace(/^log\.|^sentry\./, '');
}

function findAttributeEntry(
  attributes: unknown[],
  candidateKey: string
): AttributeEntry | undefined {
  return (
    attributes.find(
      (attribute): attribute is AttributeEntry =>
        isAttributeEntry(attribute) && attribute.name === candidateKey
    ) ??
    attributes.find(
      (attribute): attribute is AttributeEntry =>
        isAttributeEntry(attribute) &&
        prettifyAttributeName(attribute.name) === candidateKey
    )
  );
}

function getAttributeValueFromDeprecationChain(
  attributes: AttributeSource,
  deprecationChain: readonly string[],
  kind?: AttributeValueKind
): AttributeValue | undefined {
  for (const candidateKey of deprecationChain) {
    let value: unknown;

    if (Array.isArray(attributes)) {
      const attribute = findAttributeEntry(attributes, candidateKey);
      if (!attribute) {
        continue;
      }
      value = attribute.value;
    } else {
      if (!Object.hasOwn(attributes, candidateKey)) {
        continue;
      }
      value = attributes[candidateKey];
    }

    return isAttributeValue(value) &&
      (kind === undefined || isAttributeValueOfKind(value, kind))
      ? value
      : undefined;
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
      attributes as AttributeSource,
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
    attributes as AttributeSource,
    metadata.deprecationChain,
    kind
  );
}
