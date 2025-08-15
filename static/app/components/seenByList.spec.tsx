import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import SeenByList from 'sentry/components/seenByList';
import ConfigStore from 'sentry/stores/configStore';

describe('SeenByList', () => {
  beforeEach(() => {
    ConfigStore.init();
  });

  it('should return null if seenBy is falsy', () => {
    const {container} = render(<SeenByList />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should return a list of each user that saw', () => {
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

  it('filters out the current user from list of users', () => {
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
