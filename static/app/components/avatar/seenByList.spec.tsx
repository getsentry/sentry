import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import SeenByList from 'sentry/components/avatar/seenByList';
import ConfigStore from 'sentry/stores/configStore';

describe('SeenByList', function () {
  beforeEach(function () {
    ConfigStore.init();
  });

  it('should return null if seenBy is falsy', function () {
    const {container} = render(<SeenByList />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should return a list of each user that saw', function () {
    ConfigStore.set('user', UserFixture());

    render(
      <SeenByList
        seenBy={[
          UserFixture({id: '2', name: 'jane'}),
          UserFixture({id: '3', name: 'john'}),
        ]}
      />
    );

    expect(screen.getByTitle('jane')).toBeInTheDocument();
    expect(screen.getByTitle('john')).toBeInTheDocument();
  });

  it('filters out the current user from list of users', function () {
    ConfigStore.set('user', UserFixture({id: '2', name: 'jane'}));

    render(
      <SeenByList
        seenBy={[
          UserFixture({id: '2', name: 'jane'}),
          UserFixture({id: '3', name: 'john'}),
        ]}
      />
    );

    expect(screen.queryByTitle('jane')).not.toBeInTheDocument();
    expect(screen.getByTitle('john')).toBeInTheDocument();
  });
});
