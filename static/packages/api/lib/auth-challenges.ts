import { readSentryErrorDetail, SentryApiError } from "./sentry-errors.ts";

type ChallengeBase = { status: number; message: string };

/**
 * A 401 or 403 the user can clear by acting in Sentry, such as logging in with
 * SSO or confirming their password, read from the error body's `code`.
 */
export type SentryAuthChallenge = ChallengeBase &
  (
    | { code: "sso-required"; loginUrl?: string; organizationSlug?: string }
    | { code: "sudo-required" | "primary-email-verification-required"; username?: string }
    | { code: "member-disabled-over-limit"; next?: string }
    | { code: "superuser-required"; orgSlug?: string }
    | { code: "staff-required" | "2fa-required" }
  );

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
  const base = { status, message: detail.message };
  const extra = (key: string) => {
    const value = detail.extra[key];
    return typeof value === "string" ? value : undefined;
  };
  // Each case names its code: the open `SentryErrorCode` union does not narrow.
  switch (detail.code) {
    case "sso-required":
      return { ...base, code: "sso-required", loginUrl: extra("loginUrl"), organizationSlug: extra("organizationSlug") };
    case "sudo-required":
      return { ...base, code: "sudo-required", username: extra("username") };
    case "primary-email-verification-required":
      return { ...base, code: "primary-email-verification-required", username: extra("username") };
    case "member-disabled-over-limit":
      return { ...base, code: "member-disabled-over-limit", next: extra("next") };
    case "superuser-required":
      return { ...base, code: "superuser-required", orgSlug: extra("orgSlug") };
    case "staff-required":
      return { ...base, code: "staff-required" };
    case "2fa-required":
      return { ...base, code: "2fa-required" };
    default:
      return undefined;
  }
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
