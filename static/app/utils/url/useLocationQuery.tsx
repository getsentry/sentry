import {useMemo} from 'react';

import {
  decodeBoolean,
  decodeInteger,
  type decodeList,
  decodeScalar,
  type decodeSorts,
  type QueryValue,
} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

type Scalar = string | boolean | number | undefined;

type KnownDecoder =
  | typeof decodeInteger
  | typeof decodeList
  | typeof decodeScalar
  | typeof decodeSorts
  | typeof decodeBoolean;

type GenericDecoder<T = unknown> = (query: QueryValue) => T;

export type Decoder = KnownDecoder | GenericDecoder;

/**
 * Select and memoize query params from location.
 * This returns a new object only when one of the specified query fields is
 * updated. The object will remain stable otherwise, avoiding re-renders.
 *
 * You shouldn't need to manually set the `InferredRequestShape` or `InferredResponseShape`
 * generics, instead type the left side of the statement.
 *
 * For example:
 * ```
 * type QueryFields = {statsPeriod: string};
 * const query: QueryFields = useLocationQuery({
 *   fields: {statsPeriod: decodeScalar}
 * });
 * ```
 */
export default function useLocationQuery<
  InferredRequestShape extends Record<string, Scalar | Scalar[] | Decoder>,
  InferredResponseShape extends {
    readonly [Property in keyof InferredRequestShape]: InferredRequestShape[Property] extends Decoder
      ? ReturnType<InferredRequestShape[Property]>
      : InferredRequestShape[Property];
  },
>({fields}: {fields: InferredRequestShape}): InferredResponseShape {
  const location = useLocation();

  const locationFields = {};
  const forwardedFields = {};
  Object.entries(fields).forEach(([field, decoderOrValue]) => {
    if (typeof decoderOrValue === 'function') {
      if (decoderOrValue === decodeScalar) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        locationFields[field] = decoderOrValue(location.query[field], '');
      } else if (decoderOrValue === decodeBoolean) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        locationFields[field] = decoderOrValue(location.query[field], false);
      } else if (decoderOrValue === decodeInteger) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        locationFields[field] = decoderOrValue(location.query[field], 0);
      } else {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        locationFields[field] = decoderOrValue(location.query[field]);
      }
    } else {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      forwardedFields[field] = decoderOrValue;
    }
  }, {});

  const stringyForwardedFields = JSON.stringify(forwardedFields);
  const stringyLocationFields = JSON.stringify(locationFields);

  return useMemo(
    () => ({
      ...(forwardedFields as any),
      ...(locationFields as any),
    }),
    [stringyForwardedFields, stringyLocationFields] // eslint-disable-line
  );
}
