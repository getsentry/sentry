/**
 * Sentry integration for [Session Replay](https://sentry.io/for/session-replay/).
 *
 * See the [Replay documentation](https://docs.sentry.io/platforms/javascript/guides/session-replay/) for more information.
 *
 * @example
 *
 * ```
 * Sentry.init({
 *   dsn: '__DSN__',
 *   integrations: [Sentry.replayIntegration()],
 * });
 * ```
 *
 * @example Using onMutation for pre-processing mutations:
 *
 * ```
 * Sentry.init({
 *   dsn: '__DSN__',
 *   integrations: [
 *     Sentry.replayIntegration({
 *       // Backwards compatible: return false to skip processing
 *       onMutation: (mutations) => {
 *         if (mutations.length > 1000) {
 *           return false; // Skip processing large mutation batches
 *         }
 *
 *         // New feature: return array to pre-process mutations
 *         return mutations.filter(mutation => {
 *           // Filter out mutations from certain elements
 *           return !mutation.target?.classList?.contains('sensitive-data');
 *         });
 *       }
 *     })
 *   ],
 * });
 * ```
 */
export const replayIntegration = ((options?: ReplayConfiguration) => {
  return new Replay(options);
}) satisfies IntegrationFn;
