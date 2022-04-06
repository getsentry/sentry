import {Fragment} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {CommittersProvider} from 'sentry/stores/commiters/committersProvider';
import {useCommitters} from 'sentry/stores/commiters/useCommitters';

const TestProviderComponent = () => {
  const [committers] = useCommitters();
  const nodes = Object.keys(committers).flatMap(key => {
    return committers[key].committers.map(c => c.author.name);
  });

  return nodes.length > 0 ? (
    <Fragment>{nodes}</Fragment>
  ) : (
    <Fragment>empty component</Fragment>
  );
};

describe('CommittersProvider', () => {
  it('renders with no state by default', () => {
    render(
      <CommittersProvider>
        <TestProviderComponent />
      </CommittersProvider>
    );

    expect(screen.getByText(/empty component/)).toBeInTheDocument();
  });

  it('renders with initial state', () => {
    render(
      <CommittersProvider
        initialState={{
          'initial state': {
            committers: [
              TestStubs.Commit({
                author: TestStubs.CommitAuthor({name: 'testing commit'}),
              }),
            ],
            committersError: false,
            committersLoading: false,
          },
        }}
      >
        <TestProviderComponent />
      </CommittersProvider>
    );

    expect(screen.getByText(/testing commit/)).toBeInTheDocument();
  });
});
