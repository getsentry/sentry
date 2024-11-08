import {act, render} from 'sentry-test/reactTestingLibrary';

import {useUserQuery} from 'sentry/views/explore/hooks/useUserQuery';

describe('useUserQuery', function () {
  it('allows changing user query', function () {
    let userQuery, setUserQuery;

    function TestPage() {
      [userQuery, setUserQuery] = useUserQuery();
      return null;
    }

    render(<TestPage />, {disableRouterMocks: true});

    expect(userQuery).toEqual(''); // default

    act(() => setUserQuery('foo:bar'));
    expect(userQuery).toEqual('foo:bar');
  });
});
