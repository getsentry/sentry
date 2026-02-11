import {makeCombinedReducers} from 'sentry/utils/makeCombinedReducer';

describe('makeCombinedReducers', () => {
  it('calls reducer only with subset of state', () => {
    const mockFirstReducer = jest.fn();

    const reducer = makeCombinedReducers({first: mockFirstReducer, second: jest.fn()});
    reducer({first: 'first', second: ''}, 'action');

    expect(mockFirstReducer).toHaveBeenCalledWith('first', 'action');
  });

  it('calls all reducers with action', () => {
    const mockFirstReducer = jest.fn();
    const mockSecondReducer = jest.fn();

    const reducer = makeCombinedReducers({
      first: mockFirstReducer,
      second: mockSecondReducer,
    });
    reducer({first: 'first', second: 'second'}, 'action');

    expect(mockFirstReducer).toHaveBeenCalledWith('first', 'action');
    expect(mockSecondReducer).toHaveBeenCalledWith('second', 'action');
  });
});
