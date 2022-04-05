import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SimpleTableChart from 'sentry/components/charts/simpleTableChart';
import EventView from 'sentry/utils/discover/eventView';

describe('simpleTableChart', function () {
  const {router, routerContext} = initializeOrg();

  it('links trace ids to performance', async function () {
    render(
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
      {context: routerContext}
    );
    userEvent.click(await screen.findByText('abcd'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/performance/trace/abcd/',
      query: {
        pageEnd: undefined,
        pageStart: undefined,
        statsPeriod: '14d',
      },
    });
  });

  it('links event ids to event details', async function () {
    const project = TestStubs.Project();
    render(
      <SimpleTableChart
        data={[{id: 'defg', 'project.name': project.slug}]}
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
      {context: routerContext}
    );
    userEvent.click(await screen.findByText('defg'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: `/organizations/org-slug/discover/${project.slug}:defg/`,
      query: {
        display: undefined,
        environment: [],
        field: ['id'],
        id: undefined,
        interval: undefined,
        name: undefined,
        project: [project.id],
        query: '',
        sort: [],
        topEvents: undefined,
        widths: [],
        yAxis: 'count()',
      },
    });
  });
});
