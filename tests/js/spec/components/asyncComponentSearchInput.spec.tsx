import {
  act,
  mountWithTheme,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {
  AsyncComponentSearchInput,
  AsyncComponentSearchInputProps,
} from 'sentry/components/asyncComponentSearchInput';

function makeProps(
  partial: Partial<AsyncComponentSearchInputProps> = {}
): AsyncComponentSearchInputProps {
  return {
    api: new MockApiClient(),
    url: '/endpoint',
    placeholder: 'Search',
    onSearchSubmit: jest.fn(),
    onSuccess: jest.fn(),
    onError: jest.fn(),
    updateRoute: false,
    location: TestStubs.location(),
    router: TestStubs.router(),
    routes: [],
    params: {},
    ...partial,
  };
}

jest.unmock('lodash/debounce');

describe('AsyncComponentSearchInput', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    // eslint-disable-next-line no-console
    console.error = jest.fn();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  it('debounces if elapsed < debounceWait', async () => {
    const debounceWait = 500;
    const props = makeProps({url: '/endpoint', debounceWait});

    jest.spyOn(props.api, 'requestPromise').mockResolvedValue(['Response']);

    mountWithTheme(<AsyncComponentSearchInput {...props} />, {
      context: TestStubs.routerContext(),
    });

    userEvent.click(screen.getByRole('textbox'));
    userEvent.keyboard('t');

    jest.advanceTimersByTime(debounceWait / 2);
    // Flush out promises
    await Promise.resolve();

    expect(props.onSuccess).not.toHaveBeenCalled();

    userEvent.click(screen.getByRole('textbox'));
    userEvent.keyboard('e');

    await waitFor(() => expect(props.onSuccess).toHaveBeenCalledTimes(1));
  });
  it('handles out of order requests', async () => {
    const debounceWait = 500;
    const props = makeProps({url: '/endpoint', debounceWait});

    jest
      .spyOn(props.api, 'requestPromise')
      .mockReturnValue(
        // This promise will resolve after the second request,
        // but it should never call onSuccess because it is stale
        new Promise(resolve => {
          setTimeout(() => {
            resolve(['RESPONSE1']);
          }, debounceWait / 2);
        })
      )
      .mockReturnValue(
        new Promise(resolve => {
          setTimeout(() => {
            resolve(['RESPONSE2']);
          }, debounceWait / 4);
        })
      );

    mountWithTheme(<AsyncComponentSearchInput {...props} />, {
      context: TestStubs.routerContext(),
    });

    userEvent.click(screen.getByRole('textbox'));
    userEvent.type(screen.getByRole('textbox'), 'te');

    jest.advanceTimersByTime(debounceWait);
    // Flush out promises
    await Promise.resolve();

    expect(props.onSuccess).toHaveBeenLastCalledWith('RESPONSE2', undefined);
    expect(props.onSuccess).toHaveBeenCalledTimes(1);
  });
  it('renders default search bar', async () => {
    const props = makeProps({
      url: '/endpoint',
      debounceWait: 500,
      placeholder: 'Custom PlaceHolder',
    });

    mountWithTheme(<AsyncComponentSearchInput {...props} />, {
      context: TestStubs.routerContext(),
    });

    userEvent.click(screen.getByRole('textbox'));
    userEvent.keyboard('t');

    expect(await screen.findByPlaceholderText('Custom PlaceHolder')).toBeInTheDocument();
    expect(await screen.findByPlaceholderText('Custom PlaceHolder')).toHaveValue('t');
  });
  it('renders custom search bar', async () => {
    const props = makeProps({
      url: '/endpoint',
      debounceWait: 500,
    });

    jest.spyOn(props.api, 'requestPromise').mockReturnValue(
      // This promise will resolve after the second request,
      // but it should never call onSuccess because it is stale
      new Promise(resolve => {
        setTimeout(() => {
          resolve(['RESPONSE1']);
        }, 100);
      })
    );

    const render = jest.fn().mockImplementation(renderProps => {
      return (
        <input
          placeholder={renderProps.value + 'Placeholder'}
          onChange={evt => renderProps.handleChange(evt.target.value)}
        />
      );
    });

    mountWithTheme(
      <AsyncComponentSearchInput {...props}>
        {prop => render(prop)}
      </AsyncComponentSearchInput>,
      {
        context: TestStubs.routerContext(),
      }
    );

    userEvent.type(screen.getByRole('textbox'), 'Te');

    act(() => {
      jest.runAllTimers();
    });

    // First render 1, then two chararcter types + busy toggle on and off
    await waitFor(() => {
      expect(render).toHaveBeenCalledTimes(3 + 'Te'.length);
    });
    expect(render.mock.calls[2][0].value).toBe('Te');
  });
  it('updates route on form submit', async () => {
    const props = makeProps({
      url: '/endpoint',
      debounceWait: 500,
      updateRoute: true,
    });

    MockApiClient.addMockResponse({
      url: props.url,
      method: 'GET',
      body: 'RESPONSE',
    });

    mountWithTheme(<AsyncComponentSearchInput {...props} />, {
      context: props.router,
    });

    userEvent.type(screen.getByRole('textbox'), 'test');
    userEvent.keyboard('{enter}');

    jest.advanceTimersByTime(props.debounceWait as number);
    await Promise.resolve();
    await Promise.resolve();

    await waitFor(() => expect(props.onSuccess).toHaveBeenCalledTimes(1));

    expect(props.router.push).toHaveBeenLastCalledWith({
      pathname: props.location.pathname,
      query: {
        query: 'test',
      },
    });
  });
});
