import {createContext} from 'react';

import type useReplaysCount from 'sentry/components/replays/useReplaysCount';

/**
 * To set things up:
 * ```
 * const counts = useReplaysCount({
 *   groupIds: [id],
 *   organization,
 *   project,
 * });
 * return <ReplayCountContext.Provider value={counts}>{children}</ReplayCountContext.Provider>
 * ```
 *
 * And then read the data later:
 * ```
 * const count = useContext(ReplayCountContext)[groupId];
 * ```
 */
export default createContext<ReturnType<typeof useReplaysCount>>({});
