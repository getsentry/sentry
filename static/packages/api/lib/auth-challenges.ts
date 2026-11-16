import { SENTRY_ERROR_EXTRA_KEYS } from "./error-codes.gen.ts";
import { readSentryErrorDetail, SentryApiError } from "./sentry-errors.ts";
import type { KnownSentryErrorCode, SentryErrorExtra } from "./sentry-errors.ts";

type ChallengeBase = { status: number; message: string };

const CHALLENGE_CODES = [
  "sso-required",
  "sudo-required",
  "primary-email-verification-required",
  "member-disabled-over-limit",
  "superuser-required",
  "staff-required",
  "2fa-required",
] as const satisfies readonly KnownSentryErrorCode[];

type ChallengeCode = (typeof CHALLENGE_CODES)[number];

/**
 * A 401 or 403 the user can clear by acting in Sentry, such as logging in with
 * SSO or confirming their password, read from the error body's `code`. Each
 * code carries the string fields of its `extra`, such as `loginUrl` for SSO.
 */
export type SentryAuthChallenge = {
  [TCode in ChallengeCode]: ChallengeBase & { code: TCode } & SentryErrorExtra<TCode>;
}[ChallengeCode];

/** `retry` sends the request once more, after the consumer re-authenticated; `fail` keeps the response. */
export type AuthChallengeDecision = "retry" | "fail";

export type AuthChallengeHandler = (
  challenge: SentryAuthChallenge,
  request: Request,
) => AuthChallengeDecision | Promise<AuthChallengeDecision>;

type Fetch = (input: Request | string | URL, init?: RequestInit) => Promise<Response>;

/** Classify an error response; undefined when it is not an auth challenge. */
function readSentryAuthChallenge(status: number, body: unknown): SentryAuthChallenge | undefined {
  const detail = status === 401 || status === 403 ? readSentryErrorDetail(body) : undefined;
  if (!detail) {
    return undefined;
  }
  const code = CHALLENGE_CODES.find((challengeCode) => challengeCode === detail.code);
  if (!code) {
    return undefined;
  }
  // Every key of the code's `extra`, even when absent, as `string | undefined`.
  const fields = Object.fromEntries(
    SENTRY_ERROR_EXTRA_KEYS[code].map((key: string) => {
      const value = detail.extra[key];
      return [key, typeof value === "string" ? value : undefined];
    }),
  );
  return { status, message: detail.message, code, ...fields } as SentryAuthChallenge;
}

/** The auth challenge behind an SDK error, if any. */
export function getSentryAuthChallenge(error: unknown): SentryAuthChallenge | undefined {
  return error instanceof SentryApiError && typeof error.status === "number"
    ? readSentryAuthChallenge(error.status, error.body)
    : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return JSON.parse(await response.text());
  } catch {
    return undefined;
  }
}

/**
 * Wrap `fetch` so an auth challenge response calls `onAuthChallenge`. The
 * handler re-authenticates however the app does, then returns `retry` to send
 * the request once more, or `fail` to keep the response. The SDK opens no UI
 * and never redirects. The wrapper keeps a copy of each request body to replay.
 */
export function withAuthChallenges(fetch: Fetch, options: { onAuthChallenge: AuthChallengeHandler }): Fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const replay = request.clone();
    const response = await fetch(request);
    const challenge =
      response.status === 401 || response.status === 403
        ? readSentryAuthChallenge(response.status, await readJson(response.clone()))
        : undefined;
    if (!challenge || (await options.onAuthChallenge(challenge, replay.clone())) !== "retry") {
      return response;
    }
    // Release the challenge body without waiting: a failed cancel must not stop the replay.
    response.body?.cancel().catch(() => {});
    return fetch(replay);
  };
}
