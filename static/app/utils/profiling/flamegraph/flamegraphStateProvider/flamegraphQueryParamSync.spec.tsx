import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import type {DeepPartial} from 'sentry/types/utils';

import type {FlamegraphState} from './flamegraphContext';
import {FlamegraphStateProvider} from './flamegraphContextProvider';
import {FlamegraphStateQueryParamSync} from './flamegraphQueryParamSync';

function SyncedFlamegraph({initialState}: {initialState?: DeepPartial<FlamegraphState>}) {
  return (
    <FlamegraphStateProvider initialState={initialState}>
      <FlamegraphStateQueryParamSync />
    </FlamegraphStateProvider>
  );
}

describe('FlamegraphStateQueryParamSync', () => {
  it('writes the state in place and keeps unrelated params when mounted', async () => {
    const onNuqsUrlUpdate = jest.fn();

    const {router} = render(
      <SyncedFlamegraph
        initialState={{profiles: {threadId: 5}, preferences: {sorting: 'left heavy'}}}
      />,
      {
        initialRouterConfig: {
          location: {pathname: '/profile/', query: {fov: '1,2,3,4', other: 'keep'}},
        },
        onNuqsUrlUpdate,
      }
    );

    await waitFor(() => expect(router.location.query.tid).toBe('5'));
    expect(router.location.query).toEqual({
      colorCoding: 'by system vs application frame',
      sorting: 'left heavy',
      view: 'top down',
      query: '',
      tid: '5',
      other: 'keep',
    });
    expect(onNuqsUrlUpdate).toHaveBeenCalledWith(
      expect.objectContaining({options: expect.objectContaining({history: 'replace'})})
    );
  });

  it('removes a highlighted frame from the URL when the state has none', async () => {
    const {router} = render(<SyncedFlamegraph />, {
      initialRouterConfig: {
        location: {pathname: '/profile/', query: {frameName: 'foo', framePackage: 'bar'}},
      },
    });

    await waitFor(() => expect(router.location.query.view).toBe('top down'));
    expect(router.location.query.frameName).toBeUndefined();
    expect(router.location.query.framePackage).toBeUndefined();
  });

  it('keeps a lone frame name and an unknown thread id when the state has neither', async () => {
    const {router} = render(<SyncedFlamegraph />, {
      initialRouterConfig: {
        location: {pathname: '/profile/', query: {frameName: 'foo', tid: '7'}},
      },
    });

    await waitFor(() => expect(router.location.query.view).toBe('top down'));
    expect(router.location.query.frameName).toBe('foo');
    expect(router.location.query.tid).toBe('7');
  });
});
