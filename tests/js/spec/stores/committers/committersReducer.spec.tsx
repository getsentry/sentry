import {committersReducer} from 'sentry/stores/commiters/committersReducer';

describe('CommitersReducer', () => {
  it('marks committer loading and clears old state', () => {
    const newState = committersReducer(
      {},
      {
        type: 'start loading',
        payload: {
          organizationSlug: 'org',
          projectSlug: 'project slug',
          eventId: '0',
        },
      }
    );

    for (const key in newState) {
      expect(newState[key].committers).toEqual([]);
      expect(newState[key].committersLoading).toBeTruthy();
      expect(newState[key].committersError).toBeFalsy();
    }
  });

  it('marks committer error', () => {
    const newState = committersReducer(
      {},
      {
        type: 'set error',
        payload: {
          organizationSlug: 'org',
          projectSlug: 'project slug',
          eventId: '0',
        },
      }
    );

    for (const key in newState) {
      expect(newState[key].committers).toEqual([]);
      expect(newState[key].committersLoading).toBeFalsy();
      expect(newState[key].committersError).toBeTruthy();
    }
  });

  it('adds committer and nulls loading and error state', () => {
    const committers = [TestStubs.CommitAuthor()];
    const newState = committersReducer(
      {},
      {
        type: 'add committers',
        payload: {
          organizationSlug: 'org',
          projectSlug: 'project slug',
          eventId: '0',
          committers,
        },
      }
    );

    for (const key in newState) {
      expect(newState[key].committers).toEqual(committers);
      expect(newState[key].committersLoading).toBeFalsy();
      expect(newState[key].committersError).toBeFalsy();
    }
  });
});
