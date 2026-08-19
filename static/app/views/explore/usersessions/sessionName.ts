import {FILTER_MASK} from 'sentry/constants';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {getShortEventId} from 'sentry/utils/events';

import type {SessionDatasetKey} from './datasets';

/**
 * Attributes that can name a session, under names of our own so the per-dataset
 * spelling stays out of the resolver.
 *
 * Every one of these is set once on the SDK scope rather than per item, so it is
 * effectively constant across a session's telemetry. That is what lets a single
 * aggregate stand in for the whole session.
 */
type IdentityKey =
  | 'browserName'
  | 'deviceFamily'
  | 'geoCity'
  | 'geoCountry'
  | 'osName'
  | 'release'
  | 'sdkName'
  | 'userEmail'
  | 'userId'
  | 'userIp'
  | 'userUsername';

export type SessionIdentity = Partial<Record<IdentityKey, string>>;

/**
 * Tuples rather than an object so the request order is fixed and the mapping can
 * be iterated without widening every value to `string | undefined`.
 */
type FieldMap = ReadonlyArray<readonly [IdentityKey, string]>;

/** EAP spans, per `src/sentry/search/eap/spans/attributes.py`. */
const SPAN_FIELDS: FieldMap = [
  ['userEmail', 'user.email'],
  ['userUsername', 'user.username'],
  ['userId', 'user.id'],
  ['userIp', 'user.ip'],
  ['geoCity', 'user.geo.city'],
  ['geoCountry', 'user.geo.country_code'],
  ['sdkName', 'sdk.name'],
  ['browserName', 'browser.name'],
  ['osName', 'os.name'],
  ['deviceFamily', 'device.family'],
  ['release', 'release'],
];

/**
 * Errors, per the aliases in `src/sentry/snuba/events.py`. The geo fields are
 * spelled without the `user.` prefix here, and there is no aliased column for
 * browser/OS/device — those are plain tags, which an unknown-field rejection
 * would turn into a 400 for the whole query, so they are left to spans.
 */
const ERROR_FIELDS: FieldMap = [
  ['userEmail', 'user.email'],
  ['userUsername', 'user.username'],
  ['userId', 'user.id'],
  ['userIp', 'user.ip'],
  ['geoCity', 'geo.city'],
  ['geoCountry', 'geo.country_code'],
  ['sdkName', 'sdk.name'],
  ['release', 'release'],
];

/**
 * Only spans and errors define an `any()` aggregate — logs and `tracemetrics`
 * expose nothing but count/sum/avg/percentiles/min/max, and min/max there are
 * numeric-only. So there is no way to read a constant string attribute off a
 * grouped row in those two, and a session made purely of logs or metrics gets
 * named by its handle alone.
 */
const IDENTITY_FIELDS: Record<SessionDatasetKey, FieldMap> = {
  traces: SPAN_FIELDS,
  errors: ERROR_FIELDS,
  logs: [],
  metrics: [],
  // Left empty for now: feedback rides on `issuePlatform`, and rather than verify
  // which `any()` identity aggregates it accepts, a session's name is left to the
  // other datasets. A wrong field here would 400 the whole feedback count query.
  feedback: [],
};

/**
 * Placeholders Relay's PII rules leave behind. A scrubbed value has to count as
 * absent rather than as a name: `[Filtered]` would otherwise pin the session on
 * itself while a lower rung of the chain still holds something real.
 */
const SCRUBBED_VALUES = new Set([
  FILTER_MASK,
  '[creditcard]',
  '[email]',
  '[iban]',
  '[ip]',
  '[pan]',
  '[phone]',
  '[userpath]',
  '[uuid]',
]);

function usableValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed && !SCRUBBED_VALUES.has(trimmed) ? trimmed : undefined;
}

/**
 * Columns to add to a dataset's `session.id`-grouped query so its rows can name
 * the sessions they describe.
 *
 * `any()` is arbitrary within the group, which is only sound because these
 * attributes are constant per session. Errors implements it as `min` for
 * determinism; EAP does not, so a session that genuinely changed identity
 * mid-flight (anonymous, then signed in) can name itself either way.
 */
export function identityFields(key: SessionDatasetKey): string[] {
  return IDENTITY_FIELDS[key].map(([, field]) => `any(${field})`);
}

/** Reads {@link identityFields} back out of one grouped row. */
export function readIdentity(
  key: SessionDatasetKey,
  row: Record<string, unknown>
): SessionIdentity {
  const identity: SessionIdentity = {};
  IDENTITY_FIELDS[key].forEach(([attribute, field]) => {
    const value = usableValue(row[`any(${field})`]);
    if (value !== undefined) {
      identity[attribute] = value;
    }
  });
  return identity;
}

/**
 * Folds per-dataset identities into one, keeping the first usable value for each
 * attribute.
 *
 * Sifting attribute by attribute rather than picking a single winning dataset is
 * the point: a session whose spans carry only `user.id` and whose errors carry
 * `user.email` should be named by the email. It also means one dataset returning
 * an empty or scrubbed value does not stop another from filling that slot.
 */
export function mergeIdentities(identities: SessionIdentity[]): SessionIdentity {
  const merged: SessionIdentity = {};
  identities.forEach(identity => {
    (Object.keys(identity) as IdentityKey[]).forEach(attribute => {
      merged[attribute] ??= identity[attribute];
    });
  });
  return merged;
}

/** Shape the avatar takes for a session with a user behind it. */
interface SessionUser {
  email: string;
  id: string;
  ip_address: string;
  name: string;
  username: string;
}

export interface SessionName {
  /** Device and platform, pre-joined. Undefined when nothing is known. */
  context: string | undefined;
  /**
   * Short, unique, sayable — the part you paste into a ticket. Derived from the
   * id, so it is available before any telemetry comes back.
   */
  handle: string;
  release: string | undefined;
  /** Display text for whoever or whatever the session belongs to. Never empty. */
  subject: string;
  /** What `subject` names, so callers can pick a leading glyph. */
  subjectKind: 'user' | 'location' | 'sdk' | 'unknown';
  /** Present only when {@link subjectKind} is `user`, for the avatar. */
  user: SessionUser | undefined;
}

/**
 * The chain runs from most to least identifying. Each rung is a strictly weaker
 * claim about who the session belongs to, and the last two do not identify a
 * person at all — they only say where it came from, which still beats a UUID.
 */
function resolveSubject(
  identity: SessionIdentity
): Pick<SessionName, 'subject' | 'subjectKind'> {
  if (identity.userEmail) {
    return {subject: identity.userEmail, subjectKind: 'user'};
  }
  if (identity.userUsername) {
    return {subject: identity.userUsername, subjectKind: 'user'};
  }
  if (identity.userId) {
    return {subject: t('User %s', identity.userId), subjectKind: 'user'};
  }
  if (identity.userIp) {
    return {subject: identity.userIp, subjectKind: 'user'};
  }

  const location = [identity.geoCity, identity.geoCountry].filter(defined).join(', ');
  if (location) {
    return {subject: location, subjectKind: 'location'};
  }

  // Not a who at all, but it separates a backend or CLI session from a browser
  // one, which is most of what you want from a session with no user on it.
  if (identity.sdkName) {
    return {
      subject: identity.sdkName.replace(/^sentry\./, ''),
      subjectKind: 'sdk',
    };
  }

  return {subject: t('Anonymous'), subjectKind: 'unknown'};
}

export function resolveSessionName(
  sessionId: string,
  identity: SessionIdentity
): SessionName {
  const {subject, subjectKind} = resolveSubject(identity);

  return {
    handle: getShortEventId(sessionId),
    subject,
    subjectKind,
    // A browser and a device family are alternatives, not a pair — a mobile
    // session has one, a web session the other.
    context:
      [identity.browserName ?? identity.deviceFamily, identity.osName]
        .filter(defined)
        .join(' · ') || undefined,
    release: identity.release,
    user:
      subjectKind === 'user'
        ? {
            email: identity.userEmail ?? '',
            id: identity.userId ?? '',
            ip_address: identity.userIp ?? '',
            username: identity.userUsername ?? '',
            name: identity.userUsername ?? '',
          }
        : undefined,
  };
}
