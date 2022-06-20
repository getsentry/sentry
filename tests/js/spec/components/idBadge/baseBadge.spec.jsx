import {render, screen} from 'sentry-test/reactTestingLibrary';

import BaseBadge from 'sentry/components/idBadge/baseBadge';

describe('BadgeBadge', function () {
  it('has a display name', function () {
    render(
      <BaseBadge
        organization={TestStubs.Organization()}
        displayName={<span data-test-id="test">display name</span>}
      />
    );
    expect(screen.getByTestId('test')).toHaveTextContent('display name');
  });

  it('can hide avatar', function () {
    render(
      <BaseBadge organization={TestStubs.Organization()} displayName="hello" hideAvatar />
    );

    expect(screen.queryByTestId('badge-styled-avatar')).not.toBeInTheDocument(0);
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('hello');
  });

  it('can hide name', function () {
    render(
      <BaseBadge
        organization={TestStubs.Organization()}
        hideName
        displayName={<span data-test-id="test">display name</span>}
      />
    );
    expect(screen.queryByTestId('test')).not.toBeInTheDocument('display name');
  });
});
