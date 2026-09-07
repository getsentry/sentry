import {ATTRIBUTE_SEARCH_METADATA, type AttributeValue} from '@sentry/conventions';

const TYPED_TAG_KEY_RE = /tags\[(\S*),(\S*)\]/;
const ATTRIBUTE_DEPRECATION_CHAIN_BY_KEY = new Map<
  string,
  readonly string[] | undefined
>();

type AttributeValueByKind = {
  boolean: boolean;
  'boolean[]': boolean[];
  number: number | bigint;
  'number[]': number[];
  string: string;
  'string[]': string[];
};

type AttributeValueKind = keyof AttributeValueByKind;

type AttributeEntry = {
  name: string;
  value: unknown;
  type?: unknown;
};

type AttributeSource = Record<string, unknown> | AttributeEntry[];

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

function getNumericAttributeValue(value: unknown): number | bigint | undefined {
  if (typeof value === 'number' || typeof value === 'bigint') {
    return value;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const normalizedValue = value.trim();
  if (/^[+-]?\d+$/.test(normalizedValue)) {
    const integerValue = BigInt(normalizedValue);
    return integerValue >= BigInt(Number.MIN_SAFE_INTEGER) &&
      integerValue <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(integerValue)
      : integerValue;
  }

  const numberValue = Number(normalizedValue);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function getAttributeValueOfKind(
  value: unknown,
  kind: AttributeValueKind
): AttributeValue | bigint | undefined {
  switch (kind) {
    case 'number':
      return getNumericAttributeValue(value);
    case 'string':
      return typeof value === 'string' ? value : undefined;
    case 'boolean':
      return typeof value === 'boolean' ? value : undefined;
    case 'string[]':
      return Array.isArray(value) && value.every(item => typeof item === 'string')
        ? value
        : undefined;
    case 'number[]':
      return Array.isArray(value) && value.every(item => typeof item === 'number')
        ? value
        : undefined;
    case 'boolean[]':
      return Array.isArray(value) && value.every(item => typeof item === 'boolean')
        ? value
        : undefined;
    default:
      return undefined;
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

function unwrapTypedTagName(name: string): string {
  return name.match(TYPED_TAG_KEY_RE)?.[1] ?? name;
}

function prettifyAttributeName(name: string): string {
  return unwrapTypedTagName(name).replace(/^log\.|^sentry\./, '');
}

function findAttributeEntry(
  attributes: AttributeEntry[],
  candidateKey: string
): AttributeEntry | undefined {
  const unwrappedCandidateKey = unwrapTypedTagName(candidateKey);
  const prettifiedCandidateKey = prettifyAttributeName(candidateKey);

  return (
    attributes.find(
      (attribute): attribute is AttributeEntry =>
        isAttributeEntry(attribute) && attribute.name === candidateKey
    ) ??
    attributes.find(
      (attribute): attribute is AttributeEntry =>
        isAttributeEntry(attribute) &&
        unwrapTypedTagName(attribute.name) === unwrappedCandidateKey
    ) ??
    attributes.find(
      (attribute): attribute is AttributeEntry =>
        isAttributeEntry(attribute) &&
        prettifyAttributeName(attribute.name) === prettifiedCandidateKey
    )
  );
}

function getAttributeValueFromDeprecationChain(
  attributes: AttributeSource,
  deprecationChain: readonly string[],
  kind?: AttributeValueKind
): AttributeValue | bigint | undefined {
  for (const candidateKey of deprecationChain) {
    let value: unknown;

    if (Array.isArray(attributes)) {
      const attribute = findAttributeEntry(attributes, candidateKey);
      if (!attribute) {
        continue;
      }
      value = attribute.value;
    } else {
      const attributeKeys = Object.keys(attributes);
      const unwrappedCandidateKey = unwrapTypedTagName(candidateKey);
      const prettifiedCandidateKey = prettifyAttributeName(candidateKey);
      const attributeKey = Object.hasOwn(attributes, candidateKey)
        ? candidateKey
        : (attributeKeys.find(key => unwrapTypedTagName(key) === unwrappedCandidateKey) ??
          attributeKeys.find(
            key => prettifyAttributeName(key) === prettifiedCandidateKey
          ));
      if (attributeKey === undefined) {
        continue;
      }
      value = attributes[attributeKey];
    }

    return kind === undefined
      ? isAttributeValue(value)
        ? value
        : undefined
      : getAttributeValueOfKind(value, kind);
  }

  return undefined;
}

/**
 * Finds an attribute value by walking the requested key's deprecation chain in
 * metadata order. Attribute metadata lookups, including misses, are cached.
 *
 * Attributes may be a name-to-value record or an array of `{name, value}` entries.
 * Exact names take precedence over normalized typed or prefixed names. The optional
 * `kind` argument narrows the return type and validates the value at runtime. The
 * `number` kind also converts numeric strings, returning a `bigint` when an integer
 * exceeds JavaScript's safe integer range. A missing key or mismatched value returns
 * `undefined`. If the requested key has no metadata, it is looked up directly.
 *
 * @example Resolve a deprecated key from a record:
 * ```ts
 * const method = getAttributeValue(
 *   {method: 'POST'},
 *   'http.request.method',
 *   'string'
 * ); // string | undefined
 * ```
 *
 * @example Read an attribute entry array:
 * ```ts
 * const category = getAttributeValue(
 *   [{name: 'span.category', value: 'http'}],
 *   'span.category',
 *   'string'
 * ); // string | undefined
 * ```
 *
 * @example Narrow an array value:
 * ```ts
 * const citations = getAttributeValue(
 *   {'ai.citations': ['https://example.com']},
 *   'ai.citations',
 *   'string[]'
 * ); // string[] | undefined
 * ```
 *
 * @example Read a numeric attribute without losing integer precision:
 * ```ts
 * const count = getAttributeValue(
 *   {'code.lineno': '9007199254740993'},
 *   'code.lineno',
 *   'number'
 * ); // number | bigint | undefined
 * ```
 */
export function getAttributeValue<K extends AttributeValueKind>(
  attributes: AttributeSource,
  key: string,
  kind: K
): AttributeValueByKind[K] | undefined;
export function getAttributeValue(
  attributes: AttributeSource,
  key: string
): AttributeValue | undefined;
export function getAttributeValue(
  attributes: AttributeSource,
  key: string,
  kind?: AttributeValueKind
): AttributeValue | bigint | undefined {
  if (typeof attributes !== 'object' || attributes === null) {
    return undefined;
  }

  const unwrappedKey = unwrapTypedTagName(key);
  const deprecationChain = ATTRIBUTE_DEPRECATION_CHAIN_BY_KEY.get(unwrappedKey);
  if (ATTRIBUTE_DEPRECATION_CHAIN_BY_KEY.has(unwrappedKey)) {
    return getAttributeValueFromDeprecationChain(
      attributes,
      deprecationChain ?? [unwrappedKey],
      kind
    );
  }

  const metadata =
    ATTRIBUTE_SEARCH_METADATA[unwrappedKey] ??
    Object.values(ATTRIBUTE_SEARCH_METADATA).find(({deprecationChain: chain}) =>
      chain.includes(unwrappedKey)
    );

  ATTRIBUTE_DEPRECATION_CHAIN_BY_KEY.set(unwrappedKey, metadata?.deprecationChain);

  return getAttributeValueFromDeprecationChain(
    attributes,
    metadata?.deprecationChain ?? [unwrappedKey],
    kind
  );
}
