import {Component} from 'react';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import {EventView} from 'sentry/utils/discover/eventView';
import {Tags} from 'sentry/views/discover/results/tags';

const org = OrganizationFixture();
const location = LocationFixture({
  pathname: '/organizations/org-slug/discover/results/',
  query: {},
});

function makeEventView(query: string) {
  return new EventView({
    fields: [],
    sorts: [],
    query,
    project: [1],
    statsPeriod: '14d',
  } as any);
}

// Mirrors views/discover/results.tsx: params change while confirmedQuery is
// false, then confirmedQuery is pulsed true and reset from the setState callback.
class Harness extends Component<
  Record<string, never>,
  {confirmedQuery: boolean; eventView: EventView}
> {
  state = {confirmedQuery: false, eventView: makeEventView('event.type:csp')};
  changeQuery = () => this.setState({eventView: makeEventView('event.type:error')});
  confirm = () => {
    this.setState({confirmedQuery: true}, () => {
      this.setState({confirmedQuery: false});
    });
  };
  render() {
    return (
      <div>
        <Button onClick={this.changeQuery}>change</Button>
        <Button onClick={this.confirm}>confirm</Button>
        <Tags
          eventView={this.state.eventView}
          organization={org}
          location={location}
          totalValues={30}
          generateUrl={(k, v) => `/endpoint/${k}/${v}`}
          confirmedQuery={this.state.confirmedQuery}
        />
      </div>
    );
  }
}

describe('Tags confirmedQuery pulse', () => {
  it('waits for the pulse after params change, then shows tags', async () => {
    const facets = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/events-facets/`,
      body: [{key: 'release', topValues: [{count: 30, value: 'abc', name: 'abc'}]}],
    });

    render(<Harness />, {
      initialRouterConfig: {location: {pathname: location.pathname}},
    });

    await waitFor(() =>
      expect(screen.queryAllByTestId('loading-placeholder')).toHaveLength(0)
    );
    expect(facets).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', {name: 'change'}));
    expect(screen.getAllByTestId('loading-placeholder').length).toBeGreaterThan(0);
    expect(facets).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', {name: 'confirm'}));

    await waitFor(() => expect(facets).toHaveBeenCalledTimes(2));
    expect(facets).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({query: 'event.type:error'}),
      })
    );
    await waitFor(() =>
      expect(screen.queryAllByTestId('loading-placeholder')).toHaveLength(0)
    );
    expect(screen.getByRole('listitem', {name: 'release'})).toBeInTheDocument();
  });
});
