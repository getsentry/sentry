import {User} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import SeenByList from 'sentry/components/seenByList';
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
    ConfigStore.set('user', User());

    render(
      <SeenByList
        seenBy={[User({id: '2', name: 'jane'}), User({id: '3', name: 'john'})]}
      />
    );

    expect(screen.getByTitle('jane')).toBeInTheDocument();
    expect(screen.getByTitle('john')).toBeInTheDocument();
  });

  it('filters out the current user from list of users', function () {
    ConfigStore.set('user', User({id: '2', name: 'jane'}));

    render(
      <SeenByList
        seenBy={[User({id: '2', name: 'jane'}), User({id: '3', name: 'john'})]}
      />
    );

    expect(screen.queryByTitle('jane')).not.toBeInTheDocument();
    expect(screen.getByTitle('john')).toBeInTheDocument();
  });
});
