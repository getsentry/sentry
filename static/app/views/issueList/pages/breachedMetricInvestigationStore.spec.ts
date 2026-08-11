import * as indicators from 'sentry/actionCreators/indicator';
import * as queryClient from 'sentry/utils/queryClient';
import {BreachedMetricInvestigationStore} from 'sentry/views/issueList/pages/breachedMetricInvestigationStore';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, reject, resolve};
}

describe('BreachedMetricInvestigationStore', () => {
  afterEach(() => jest.restoreAllMocks());

  it('batches registered rows and hides them until availability resolves', async () => {
    const request = deferred<{
      items: Record<string, {openPeriodId: string; status: 'investigate'}>;
    }>();
    const fetchMutation = jest
      .spyOn(queryClient, 'fetchMutation')
      .mockReturnValue(request.promise);
    const store = new BreachedMetricInvestigationStore('sentry', jest.fn());

    store.register('1');
    store.register('2');
    expect(store.actionFor('1')).toBeNull();
    await Promise.resolve();

    expect(fetchMutation).toHaveBeenCalledTimes(1);
    expect(fetchMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {groupIds: ['1', '2']},
        method: 'POST',
      })
    );

    request.resolve({
      items: {
        '1': {status: 'investigate', openPeriodId: 'period-1'},
        '2': {status: 'investigate', openPeriodId: 'period-2'},
      },
    });
    await request.promise;
    await Promise.resolve();

    expect(store.actionFor('1')).toEqual({kind: 'investigate', busy: false});
    expect(store.actionFor('2')).toEqual({kind: 'investigate', busy: false});
  });

  it('launches optimistically and transitions to View investigation', async () => {
    const request = deferred<{id: string}>();
    jest.spyOn(queryClient, 'fetchMutation').mockReturnValue(request.promise);
    const navigate = jest.fn();
    const store = new BreachedMetricInvestigationStore('sentry', navigate);
    store.availability.set('1', {
      status: 'investigate',
      openPeriodId: 'period-1',
    });

    const launch = store.launch('1');
    expect(store.actionFor('1')).toEqual({kind: 'investigate', busy: true});

    request.resolve({id: 'investigation-1'});
    await launch;

    expect(store.actionFor('1')).toEqual({kind: 'view', busy: false});
    expect(navigate).toHaveBeenCalledWith('/organizations/sentry/seer/investigation-1/');
  });

  it('rolls back a failed optimistic launch', async () => {
    jest.spyOn(queryClient, 'fetchMutation').mockRejectedValue(new Error('offline'));
    const errorMessage = jest.spyOn(indicators, 'addErrorMessage');
    const store = new BreachedMetricInvestigationStore('sentry', jest.fn());
    store.availability.set('1', {
      status: 'investigate',
      openPeriodId: 'period-1',
    });

    await store.launch('1');

    expect(store.actionFor('1')).toEqual({kind: 'investigate', busy: false});
    expect(errorMessage).toHaveBeenCalledWith(
      'Unable to create the investigation. Please try again.'
    );
  });

  it('opens an existing investigation without launching', async () => {
    const fetchMutation = jest.spyOn(queryClient, 'fetchMutation');
    const navigate = jest.fn();
    const store = new BreachedMetricInvestigationStore('sentry', navigate);
    store.availability.set('1', {
      status: 'view',
      investigationId: 'existing',
      openPeriodId: 'period-1',
    });

    await store.launch('1');

    expect(fetchMutation).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/organizations/sentry/seer/existing/');
  });
});
