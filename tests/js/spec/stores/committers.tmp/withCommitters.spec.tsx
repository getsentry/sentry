import {Fragment} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {CommittersProvider} from 'sentry/stores/commiters/committersProvider';
import {useCommitters} from 'sentry/stores/commiters/useCommitters';
import {withCommitters} from 'sentry/stores/commiters/withCommitters';

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
