import {BreadcrumbLevelType, BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';
import {getCurrentUserAction} from 'sentry/utils/replays/getCurrentUserAction';

it('should return the current user action given a list of userActions, a timestamp and the current time', function () {
  const userActionCrumbs: Crumb[] = [
    {
      category: 'ui.click',
      color: 'purple300',
      data: undefined,
      description: 'User Action',
      event_id: null,
      id: 3,
      level: BreadcrumbLevelType.INFO,
      message: 'div.App > section.padding-b-2 > div.makeStyles-search-input-2 > input',
      timestamp: '2022-05-04T19:47:08.085000Z',
      type: BreadcrumbType.UI,
    },
    {
      category: 'ui.input',
      color: 'purple300',
      data: undefined,
      description: 'User Action',
      event_id: null,
      id: 4,
      level: BreadcrumbLevelType.INFO,
      message: 'div.App > section.padding-b-2 > div.makeStyles-search-input-2 > input',
      timestamp: '2022-05-04T19:47:11.086000Z',
      type: BreadcrumbType.UI,
    },
    {
      category: 'ui.click',
      color: 'purple300',
      data: undefined,
      description: 'User Action',
      event_id: null,
      id: 20,
      level: BreadcrumbLevelType.INFO,
      message: 'div.App > section.padding-b-2 > div.makeStyles-search-input-2 > input',
      timestamp: '2022-05-04T19:47:52.915000Z',
      type: BreadcrumbType.UI,
    },
    {
      category: 'navigation',
      color: 'green300',
      data: {
        from: '/organizations/sentry/user-feedback/?project=6380506',
        to: '/organizations/sentry/issues/',
      },
      description: 'Navigation',
      event_id: null,
      id: 166,
      level: BreadcrumbLevelType.INFO,
      message: undefined,
      timestamp: '2022-05-04T19:47:59.915000Z',
      type: BreadcrumbType.NAVIGATION,
    },
  ];
  const startTimestamp: number = 1651693622.951;
  const currentTime: number = 15000;
  const results = getCurrentUserAction(userActionCrumbs, startTimestamp, currentTime);

  expect(results).toMatchInlineSnapshot(`
    Object {
      "category": "ui.input",
      "color": "purple300",
      "data": undefined,
      "description": "User Action",
      "event_id": null,
      "id": 4,
      "level": "info",
      "message": "div.App > section.padding-b-2 > div.makeStyles-search-input-2 > input",
      "timestamp": "2022-05-04T19:47:11.086000Z",
      "type": "ui",
    }
  `);
});
