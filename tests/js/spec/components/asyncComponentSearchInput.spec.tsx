import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

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

    MockApiClient.addMockResponse({
      url: props.url,
      method: 'GET',
      body: 'RESPONSE',
    });

    mountWithTheme(<AsyncComponentSearchInput {...props} />, {
      context: TestStubs.routerContext(),
    });

    act(() => {
      userEvent.click(screen.getByRole('textbox'));
      userEvent.keyboard('t');
    });

    jest.advanceTimersByTime(debounceWait / 2);
    // Flush out promises
    await Promise.resolve();

    expect(props.onSuccess).not.toHaveBeenCalled();

    act(() => {
      userEvent.click(screen.getByRole('textbox'));
      userEvent.keyboard('e');
    });

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

    act(() => {
      userEvent.click(screen.getByRole('textbox'));
      userEvent.keyboard('t');
      userEvent.keyboard('te');
    });

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

    act(() => {
      userEvent.click(screen.getByRole('textbox'));
      userEvent.keyboard('t');
    });

    expect(await screen.findByPlaceholderText('Custom PlaceHolder')).toBeInTheDocument();
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

    act(() => {
      userEvent.type(screen.getByRole('textbox'), 'Te');
    });

    jest.advanceTimersByTime(500);
    // Flush out promises
    await Promise.resolve();

    // First render 1 for each character typed
    expect(render).toHaveBeenCalledTimes(1 + 'Te'.length);
    expect(render.mock.calls[1][0].value).toBe('Te');
  });
  it('updates route onSubmit', async () => {
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

    act(async () => {
      fireEvent.change(screen.getByRole('textbox'), {target: {value: 'test'}});

      jest.advanceTimersByTime(500);
      await Promise.resolve();

      fireEvent.submit(screen.getByRole('textbox'));
    });

    await waitFor(() => expect(props.onSuccess).toHaveBeenCalledTimes(1));

    expect(props.router.push).toHaveBeenLastCalledWith({
      pathname: props.location.pathname,
      query: {
        query: 'test',
      },
    });
  });
});
