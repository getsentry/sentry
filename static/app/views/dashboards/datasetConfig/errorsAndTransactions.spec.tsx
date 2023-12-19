import {Project as ProjectFixture} from 'sentry-fixture/project';
import {User} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventView, {EventViewOptions} from 'sentry/utils/discover/eventView';
import {getCustomEventsFieldRenderer} from 'sentry/views/dashboards/datasetConfig/errorsAndTransactions';

describe('getCustomFieldRenderer', function () {
  const {organization, router, routerContext} = initializeOrg();

  const baseEventViewOptions: EventViewOptions = {
    start: undefined,
    end: undefined,
    createdBy: User(),
    display: undefined,
    fields: [],
    sorts: [],
    query: '',
    project: [],
    environment: [],
    yAxis: 'count()',
    id: undefined,
    name: undefined,
    statsPeriod: '14d',
    team: [],
    topEvents: undefined,
  };

  it('links trace ids to performance', async function () {
    const customFieldRenderer = getCustomEventsFieldRenderer('trace', {});
    render(
      customFieldRenderer(
        {trace: 'abcd'},
        {
          organization,
          location: router.location,
          eventView: new EventView({
            ...baseEventViewOptions,
            fields: [{field: 'trace'}],
          }),
        }
      ) as React.ReactElement<any, any>,
      {context: routerContext}
    );
    await userEvent.click(await screen.findByText('abcd'));
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
    const project = ProjectFixture();
    const customFieldRenderer = getCustomEventsFieldRenderer('id', {});
    render(
      customFieldRenderer(
        {id: 'defg', 'project.name': project.slug},
        {
          organization,
          location: router.location,
          eventView: new EventView({
            ...baseEventViewOptions,
            fields: [{field: 'id'}],
            project: [parseInt(project.id, 10)],
          }),
        }
      ) as React.ReactElement<any, any>,
      {context: routerContext}
    );

    await userEvent.click(await screen.findByText('defg'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: `/organizations/org-slug/discover/${project.slug}:defg/`,
      query: {
        display: undefined,
        environment: [],
        field: ['id'],
        id: undefined,
        interval: undefined,
        name: undefined,
        project: [parseInt(project.id, 10)],
        query: '',
        sort: [],
        topEvents: undefined,
        widths: [],
        yAxis: 'count()',
        pageEnd: undefined,
        pageStart: undefined,
        statsPeriod: '14d',
      },
    });
  });

  it('links << unparameterized >> title/transaction columns to event details', async function () {
    const project = ProjectFixture();
    const customFieldRenderer = getCustomEventsFieldRenderer('title', {});
    render(
      customFieldRenderer(
        {title: '<< unparameterized >>'},
        {
          organization,
          location: router.location,
          eventView: new EventView({
            ...baseEventViewOptions,
            fields: [{field: 'id'}],
            project: [parseInt(project.id, 10)],
          }),
        }
      ) as React.ReactElement<any, any>,
      {context: routerContext}
    );

    await userEvent.click(await screen.findByText('<< unparameterized >>'));
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
