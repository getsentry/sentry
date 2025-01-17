import type {ReactNode} from 'react';
import {IncrementalSource, Replayer} from '@sentry-internal/rrweb';
import {
  RRWebFullSnapshotFrameEventFixture,
  RRWebHelloWorldFrameFixture,
  RRWebIncrementalSnapshotFrameEventFixture,
  RRWebInitFrameEventsFixture,
} from 'sentry-fixture/replay/rrweb';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {
  ReplayPlayerStateContextProvider,
  useReplayPlayerState,
  useReplayPlayerStateDispatch,
  useReplayUserAction,
} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';

function wrapper({children}: {children?: ReactNode}) {
  return <ReplayPlayerStateContextProvider>{children}</ReplayPlayerStateContextProvider>;
}

const INIT_DATE = new Date('2022-06-15T00:40:00.100Z');
const FULL_DATE = new Date('2022-06-15T00:40:00.200Z');
const INCR_DATE = new Date('2022-06-15T00:40:05.000Z');

const RRWEB_EVENTS = [
  ...RRWebInitFrameEventsFixture({timestamp: INIT_DATE}),
  RRWebFullSnapshotFrameEventFixture({timestamp: FULL_DATE}),
  RRWebIncrementalSnapshotFrameEventFixture({
    timestamp: INCR_DATE,
    data: {
      source: IncrementalSource.Mutation,
      adds: [
        {
          node: RRWebHelloWorldFrameFixture(),
          parentId: 0,
          nextId: null,
        },
      ],
      removes: [],
      texts: [],
      attributes: [],
    },
  }),
];

describe('replayPlayerStateContext', () => {
  let replayerOnMock: any;
  let replayerOffMock: any;
  let replayerPlayMock: any;
  let replayerPauseMock: any;

  beforeEach(() => {
    replayerOnMock = jest.spyOn(Replayer.prototype, 'on').mockImplementation(jest.fn());
    replayerOffMock = jest.spyOn(Replayer.prototype, 'off').mockImplementation(jest.fn());
    replayerPlayMock = jest
      .spyOn(Replayer.prototype, 'play')
      .mockImplementation(jest.fn());
    replayerPauseMock = jest
      .spyOn(Replayer.prototype, 'pause')
      .mockImplementation(jest.fn());
  });

  afterEach(() => {
    replayerOnMock.mockReset();
    replayerOffMock.mockReset();
    replayerPlayMock.mockReset();
    replayerPauseMock.mockReset();
  });

  it('should track basic state when replayer instances change', () => {
    const {result} = renderHook(
      () => ({
        state: useReplayPlayerState(),
        dispatch: useReplayPlayerStateDispatch(),
      }),
      {wrapper}
    );

    expect(result.current.state).toEqual({
      currentSpeed: 1,
      dimensions: {width: 0, height: 0},
      isFinished: false,
      playerState: 'paused',
      replayerCleanup: expect.any(Map),
      replayers: [],
      speedState: 'normal',
    });

    const dispatch = result.current.dispatch;

    act(() => dispatch({type: 'didStart'}));
    expect(result.current.state).toStrictEqual(
      expect.objectContaining({
        playerState: 'playing',
        isFinished: false,
      })
    );

    act(() => dispatch({type: 'didPause'}));
    expect(result.current.state).toStrictEqual(
      expect.objectContaining({
        playerState: 'paused',
        isFinished: false,
      })
    );

    act(() => dispatch({type: 'didResume'}));
    expect(result.current.state).toStrictEqual(
      expect.objectContaining({
        playerState: 'playing',
        isFinished: false,
      })
    );

    act(() => dispatch({type: 'didFinish'}));
    expect(result.current.state).toStrictEqual(
      expect.objectContaining({
        playerState: 'paused',
        isFinished: true,
      })
    );
  });

  it('should track mounted and unmounted Replayer instances', () => {
    const {result} = renderHook(
      () => ({
        state: useReplayPlayerState(),
        dispatch: useReplayPlayerStateDispatch(),
      }),
      {wrapper}
    );

    const dispatch = result.current.dispatch;
    const replayer1 = new Replayer(RRWEB_EVENTS, {});
    const replayer2 = new Replayer(RRWEB_EVENTS, {});

    expect(result.current.state.replayers).toStrictEqual([]);
    expect(result.current.state.replayerCleanup.has(replayer1)).toBeFalsy();
    expect(result.current.state.replayerCleanup.has(replayer2)).toBeFalsy();

    act(() => dispatch({type: 'didMountPlayer', dispatch, replayer: replayer1}));
    act(() => dispatch({type: 'didMountPlayer', dispatch, replayer: replayer2}));
    expect(result.current.state.replayers).toStrictEqual([replayer1, replayer2]);
    expect(result.current.state.replayerCleanup.has(replayer1)).toBeTruthy();
    expect(result.current.state.replayerCleanup.has(replayer2)).toBeTruthy();

    act(() => dispatch({type: 'didUnmountPlayer', replayer: replayer1}));
    expect(result.current.state.replayers).toStrictEqual([replayer2]);
    expect(result.current.state.replayerCleanup.has(replayer1)).toBeFalsy();
    expect(result.current.state.replayerCleanup.has(replayer2)).toBeTruthy();
  });

  it('should have a stable reference to the dispatch() method when Replayer instances are added/removed', () => {
    const {result} = renderHook(
      () => ({
        state: useReplayPlayerState(),
        dispatch: useReplayPlayerStateDispatch(),
        userAction: useReplayUserAction(),
      }),
      {wrapper}
    );

    const initialDispatch = result.current.dispatch;
    const replayer = new Replayer(RRWEB_EVENTS, {});

    expect(result.current.state.replayers).toHaveLength(0);

    act(() =>
      initialDispatch({type: 'didMountPlayer', dispatch: initialDispatch, replayer})
    );
    expect(result.current.state.replayers).toHaveLength(1);
    expect(result.current.dispatch).toBe(initialDispatch);

    act(() => initialDispatch({type: 'didUnmountPlayer', replayer}));
    expect(result.current.state.replayers).toHaveLength(0);
    expect(result.current.dispatch).toBe(initialDispatch);
  });

  it('should return a new userAction whenever a Replayer instance is added/removed', () => {
    const {result} = renderHook(
      () => ({
        state: useReplayPlayerState(),
        dispatch: useReplayPlayerStateDispatch(),
        userAction: useReplayUserAction(),
      }),
      {wrapper}
    );

    const dispatch = result.current.dispatch;
    const initialUserAction = result.current.userAction;
    const replayer = new Replayer(RRWEB_EVENTS, {});

    expect(result.current.state.replayers).toHaveLength(0);

    act(() => dispatch({type: 'didMountPlayer', dispatch, replayer}));
    const secondUserAction = result.current.userAction;
    expect(result.current.state.replayers).toHaveLength(1);
    expect(secondUserAction).not.toBe(initialUserAction);

    act(() => dispatch({type: 'didUnmountPlayer', replayer}));
    const thirdUserAction = result.current.userAction;
    expect(result.current.state.replayers).toHaveLength(0);
    expect(secondUserAction).not.toBe(initialUserAction);
    expect(thirdUserAction).not.toBe(initialUserAction);
    expect(secondUserAction).not.toBe(thirdUserAction);
  });

  it('should tell mounted players jump to the specified timestamp', () => {
    const {result} = renderHook(
      () => ({
        dispatch: useReplayPlayerStateDispatch(),
        userAction: useReplayUserAction(),
      }),
      {wrapper}
    );

    const dispatch = result.current.dispatch;
    const replayer = new Replayer(RRWEB_EVENTS, {});

    act(() => dispatch({type: 'didMountPlayer', dispatch, replayer}));
    act(() => result.current.userAction({type: 'jumpToOffset', offsetMs: 1000}));
    expect(replayerPauseMock).toHaveBeenLastCalledWith(1000);
  });
});
