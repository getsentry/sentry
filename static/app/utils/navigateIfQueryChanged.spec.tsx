import {LocationFixture} from 'sentry-fixture/locationFixture';

import {navigateIfQueryChanged} from 'sentry/utils/navigateIfQueryChanged';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';

describe('navigateIfQueryChanged', () => {
  it('does not navigate when the query is unchanged', () => {
    const navigate: ReactRouter3Navigate = jest.fn();
    const location = LocationFixture({query: {foo: 'bar'}});

    navigateIfQueryChanged(navigate, location, {query: {foo: 'bar'}});

    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates when the query changed', () => {
    const navigate: ReactRouter3Navigate = jest.fn();
    const location = LocationFixture({pathname: '/foo/', query: {foo: 'bar'}});

    navigateIfQueryChanged(navigate, location, {query: {foo: 'baz'}});

    expect(navigate).toHaveBeenCalledWith(
      {pathname: '/foo/', query: {foo: 'baz'}},
      undefined
    );
  });

  it('does not navigate when just the query key order is changed', () => {
    const navigate: ReactRouter3Navigate = jest.fn();
    const location = LocationFixture({query: {a: '1', b: '2'}});

    navigateIfQueryChanged(navigate, location, {query: {b: '2', a: '1'}});

    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates with navigate options passed through when they are provided', () => {
    const navigate: ReactRouter3Navigate = jest.fn();
    const location = LocationFixture({pathname: '/foo/', query: {foo: 'bar'}});

    navigateIfQueryChanged(navigate, location, {query: {foo: 'baz'}}, {replace: true});

    expect(navigate).toHaveBeenCalledWith(
      {pathname: '/foo/', query: {foo: 'baz'}},
      {replace: true}
    );
  });

  it('navigates with defaulting the target pathname to the current location pathname when it is not provided', () => {
    const navigate: ReactRouter3Navigate = jest.fn();
    const location = LocationFixture({pathname: '/current/', query: {foo: 'bar'}});

    navigateIfQueryChanged(navigate, location, {query: {foo: 'baz'}});

    expect(navigate).toHaveBeenCalledWith(
      {pathname: '/current/', query: {foo: 'baz'}},
      undefined
    );
  });

  it('does not navigate when only the pathname changed', () => {
    const navigate: ReactRouter3Navigate = jest.fn();
    const location = LocationFixture({pathname: '/foo/', query: {foo: 'bar'}});

    navigateIfQueryChanged(navigate, location, {
      pathname: '/other/',
      query: {foo: 'bar'},
    });

    expect(navigate).not.toHaveBeenCalled();
  });
});
