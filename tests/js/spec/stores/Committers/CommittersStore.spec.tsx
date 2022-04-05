import {Fragment} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  CommittersProvider,
  committersReducer,
  useCommitters,
  withCommitters,
} from 'sentry/stores/Commiters/CommittersContext';

describe('CommitersReducer', () => {
  it('marks committer loading and clears old state', () => {
    const newState = committersReducer(
      {},
      {
        type: 'start loading',
        payload: {
          organizationSlug: 'org',
          projectSlug: 'project slug',
          eventId: '0',
        },
      }
    );

    for (const key in newState) {
      expect(newState[key].committers).toEqual([]);
      expect(newState[key].committersLoading).toBeTruthy();
      expect(newState[key].committersError).toBeFalsy();
    }
  });

  it('marks committer error', () => {
    const newState = committersReducer(
      {},
      {
        type: 'set error',
        payload: {
          organizationSlug: 'org',
          projectSlug: 'project slug',
          eventId: '0',
        },
      }
    );

    for (const key in newState) {
      expect(newState[key].committers).toEqual([]);
      expect(newState[key].committersLoading).toBeFalsy();
      expect(newState[key].committersError).toBeTruthy();
    }
  });

  it('adds committer and nulls loading and error state', () => {
    const committers = [TestStubs.CommitAuthor()];
    const newState = committersReducer(
      {},
      {
        type: 'add committers',
        payload: {
          organizationSlug: 'org',
          projectSlug: 'project slug',
          eventId: '0',
          committers,
        },
      }
    );

    for (const key in newState) {
      expect(newState[key].committers).toEqual(committers);
      expect(newState[key].committersLoading).toBeFalsy();
      expect(newState[key].committersError).toBeFalsy();
    }
  });
});

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

const TestHOCComponent = withCommitters(({committers}) => {
  const [state] = useCommitters();
  const nodes = committers?.map(c => c.author.name) ?? [];

  if (Object.keys(state).some(key => state[key].committersError)) {
    return <Fragment>component errored</Fragment>;
  }
  if (Object.keys(state).some(key => state[key].committersLoading)) {
    return <Fragment>component loading</Fragment>;
  }
  return <Fragment>{nodes.length > 0 ? nodes : 'empty component'}</Fragment>;
});

describe('withCommitters', () => {
  it('provides committers', async () => {
    const props = {
      organization: TestStubs.Organization(),
      project: TestStubs.Project(),
      event: TestStubs.Event(),
      group: TestStubs.Group({firstRelease: TestStubs.Release()}),
    };

    MockApiClient.addMockResponse({
      url: `/projects/${props.organization.slug}/${props.project.slug}/events/${props.event.id}/committers/`,
      method: 'GET',
      body: {
        committers: [
          TestStubs.Commit({author: TestStubs.CommitAuthor({name: 'testing user'})}),
        ],
      },
    });

    render(
      <CommittersProvider>
        <TestHOCComponent {...props} />
      </CommittersProvider>
    );

    expect(await screen.findByText(/testing user/)).toBeInTheDocument();
  });

  it('tries fetching committers again if first call failed', async () => {
    const props = {
      organization: TestStubs.Organization(),
      project: TestStubs.Project(),
      event: TestStubs.Event(),
      group: TestStubs.Group({firstRelease: TestStubs.Release()}),
    };

    MockApiClient.addMockResponse({
      url: `/projects/${props.organization.slug}/${props.project.slug}/events/${props.event.id}/committers/`,
      method: 'GET',
      statusCode: 401,
    });

    // This first render will error
    const {unmount} = render(
      <CommittersProvider>
        <TestHOCComponent {...props} />
      </CommittersProvider>
    );

    expect(await screen.findByText(/component errored/)).toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: `/projects/${props.organization.slug}/${props.project.slug}/events/${props.event.id}/committers/`,
      method: 'GET',
      body: {
        committers: [
          TestStubs.Commit({author: TestStubs.CommitAuthor({name: 'testing user'})}),
        ],
      },
    });

    // If a component gets remounted and the store contains errored state,
    // we want to see if we can resolve the data now and try refetching
    unmount();
    render(
      <CommittersProvider>
        <TestHOCComponent {...props} />
      </CommittersProvider>
    );

    expect(await screen.findByText(/testing user/)).toBeInTheDocument();
  });
});
