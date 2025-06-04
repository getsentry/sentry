import {compareProfiles} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphThreadSelector';

describe('compareProfiles', function () {
  it('should thread appropriately', function () {
    const namedA = {
      name: 'a',
      threadId: 1,
    };
    const namedB = {
      name: 'b',
      threadId: 2,
    };
    const namedC = {
      name: 'c',
      threadId: 3,
    };
    const unnamed4 = {
      name: '',
      threadId: 4,
    };
    const unnamed5 = {
      name: '',
      threadId: 5,
    };
    const active = {
      name: '',
      threadId: 6,
    };
    const profiles = [unnamed5, unnamed4, namedC, namedB, namedA, active];
    const sortedProfiles = profiles.sort(compareProfiles(active.threadId));
    expect(sortedProfiles).toEqual([active, namedA, namedB, namedC, unnamed4, unnamed5]);
  });

  it('should work with no active thread id', function () {
    const namedA = {
      name: 'a',
      threadId: 1,
    };
    const namedB = {
      name: 'b',
      threadId: 2,
    };
    const namedC = {
      name: 'c',
      threadId: 3,
    };
    const unnamed4 = {
      name: '',
      threadId: 4,
    };
    const unnamed5 = {
      name: '',
      threadId: 5,
    };
    const unnamed6 = {
      name: '',
      threadId: 6,
    };
    const profiles = [unnamed5, unnamed4, namedC, namedB, namedA, unnamed6];
    const sortedProfiles = profiles.sort(compareProfiles(undefined));
    expect(sortedProfiles).toEqual([
      namedA,
      namedB,
      namedC,
      unnamed4,
      unnamed5,
      unnamed6,
    ]);
  });
});
