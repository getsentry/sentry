import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {getCustomEventsFieldRenderer} from 'sentry/views/dashboards/datasetConfig/errorsAndTransactions';

describe('getCustomFieldRenderer', function () {
  const {organization, router, routerContext} = initializeOrg();

  it('links trace ids to performance', async function () {
    const customFieldRenderer = getCustomEventsFieldRenderer('trace', {});
    render(
      customFieldRenderer(
        {trace: 'abcd'},
        {
          organization,
          location: router.location,
          eventView: new EventView({
            fields: [{field: 'trace'}],
          }),
        }
      ),
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
    const customFieldRenderer = getCustomEventsFieldRenderer('id', {});
    render(
      customFieldRenderer(
        {id: 'defg', 'project.name': project.slug},
        {
          organization,
          location: router.location,
          eventView: new EventView({
            fields: [{field: 'id'}],
            project: [project.id],
          }),
        }
      ),
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

  it('links << unparameterized >> title/transaction columns to event details', async function () {
    const project = TestStubs.Project();
    const customFieldRenderer = getCustomEventsFieldRenderer('title', {});
    render(
      customFieldRenderer(
        {title: '<< unparameterized >>'},
        {
          organization,
          location: router.location,
          eventView: new EventView({
            fields: [{field: 'id'}],
            project: [project.id],
          }),
        }
      ),
      {context: routerContext}
    );

    userEvent.click(await screen.findByText('<< unparameterized >>'));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: `/organizations/org-slug/discover/results/`,
        query: expect.objectContaining({
          query: 'event.type:transaction transaction.source:"url"',
        }),
      })
    );
  });
});
