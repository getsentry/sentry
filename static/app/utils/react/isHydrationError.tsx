const REGEXP =
  /(does not match server-rendered HTML|Hydration failed because|error while hydrating)/i;

export default function isHydrationError(errorTitle: string) {
  // Hydration Errors captured by the errors-SDK will match the REGEXP above
  // while errors generated from the Replay Breadcrumb Ingest will have a static
  // title set inside `report_hydration_error_issue_with_replay_event()`
  // See: https://github.com/getsentry/sentry/blob/87e90b595620b76c1afaac247ffde6065c9cc7a5/src/sentry/replays/usecases/ingest/issue_creation.py#L22
  return REGEXP.test(errorTitle) || errorTitle === 'Hydration Error';
}
