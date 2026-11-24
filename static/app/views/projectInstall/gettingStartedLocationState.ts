/**
 * History state that the project creation flows put on the getting-started
 * entry they push. History state belongs to that one entry, so a shared link,
 * a bookmark, or an in-app link to the same URL never carries it. Only
 * browser Back from that entry returns to project creation.
 */
export const FROM_PROJECT_CREATION_STATE = {fromProjectCreation: true} as const;

export function isFromProjectCreation(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'fromProjectCreation' in state &&
    state.fromProjectCreation === true
  );
}
