import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import * as globalSelection from 'sentry/actionCreators/pageFilters';
import SimpleTableChart from 'sentry/components/charts/simpleTableChart';
import EventView from 'sentry/utils/discover/eventView';

jest.mock('sentry/components/charts/eventsRequest', () => jest.fn(() => null));
jest.spyOn(globalSelection, 'updateDateTime');
jest.mock(
  'sentry/components/charts/eventsGeoRequest',
  () =>
    ({children}) =>
      children({
        errored: false,
        loading: false,
        reloading: false,
        tableData: [],
      })
);

describe('simpleTableChart', function () {
  const {routerContext} = initializeOrg();
  let wrapper;

  beforeEach(function () {
    globalSelection.updateDateTime.mockClear();
  });

  it('links trace ids to performance', function () {
    wrapper = mountWithTheme(
      <SimpleTableChart
        data={[{trace: 'abcd'}]}
        eventView={
          new EventView({
            fields: [{field: 'trace'}],
          })
        }
        fields={['trace']}
        fieldAliases={['']}
        loading={false}
        location={{query: {}}}
      />,
      routerContext
    );
    const trace = wrapper.find('Link[data-test-id="view-trace"]');
    expect(trace.first().props().to.pathname).toBe(
      '/organizations/org-slug/performance/trace/abcd/'
    );
  });

  it('links event ids to event details', function () {
    const project = TestStubs.Project();
    wrapper = mountWithTheme(
      <SimpleTableChart
        data={[{id: 'abcd', 'project.name': project.slug}]}
        eventView={
          new EventView({
            fields: [{field: 'id'}],
            project: [project.id],
          })
        }
        fields={['id']}
        fieldAliases={['']}
        loading={false}
        location={{query: {}}}
      />,
      routerContext
    );
    const trace = wrapper.find('Link[data-test-id="view-event"]');
    expect(trace.first().props().to.pathname).toBe(
      `/organizations/org-slug/discover/${project.slug}:abcd/`
    );
  });
});
