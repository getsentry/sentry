import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {searchReferencesReplayId} from 'sentry/views/explore/logs/useLogsStoredReplaysOnly';

describe('searchReferencesReplayId', () => {
  it('returns true when the query uses has:replay_id', () => {
    expect(searchReferencesReplayId(new MutableSearch('has:replay_id'))).toBe(true);
  });

  it('returns true when the query filters on a replay_id value', () => {
    expect(searchReferencesReplayId(new MutableSearch('replay_id:abc123'))).toBe(true);
  });

  it('returns false when the query does not mention replays', () => {
    expect(searchReferencesReplayId(new MutableSearch('severity:error'))).toBe(false);
  });

  it('returns false when the query only has other has: filters', () => {
    expect(searchReferencesReplayId(new MutableSearch('has:trace'))).toBe(false);
  });
});
