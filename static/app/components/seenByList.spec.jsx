import {render, screen} from 'sentry-test/reactTestingLibrary';

import SeenByList from 'sentry/components/seenByList';
import ConfigStore from 'sentry/stores/configStore';

describe('SeenByList', function () {
  beforeEach(function () {
    jest.spyOn(ConfigStore, 'get').mockImplementation(() => ({}));
  });

  it('should return null if seenBy is falsy', function () {
    const {container} = render(<SeenByList />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should return a list of each user that saw', function () {
    render(
      <SeenByList
        seenBy={[
          {id: '1', email: 'jane@example.com'},
          {id: '2', email: 'john@example.com'},
        ]}
      />
    );

    expect(screen.getByTitle('jane@example.com')).toBeInTheDocument();
    expect(screen.getByTitle('john@example.com')).toBeInTheDocument();
  });

  it('filters out the current user from list of users', function () {
    jest
      .spyOn(ConfigStore, 'get')
      .mockImplementation(() => ({id: '1', email: 'jane@example.com'}));

    render(
      <SeenByList
        seenBy={[
          {id: '1', email: 'jane@example.com'},
          {id: '2', email: 'john@example.com'},
        ]}
      />
    );

    expect(screen.queryByTitle('jane@example.com')).not.toBeInTheDocument();
    expect(screen.getByTitle('john@example.com')).toBeInTheDocument();
  });
});
