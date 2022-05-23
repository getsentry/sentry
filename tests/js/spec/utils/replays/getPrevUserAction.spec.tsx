import {BreadcrumbLevelType, BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';
import {getPrevUserAction} from 'sentry/utils/replays/getUserAction';

const START_TIMESTAMP_SEC = 1651693622.951;
const CURRENT_TIME_MS = 15000;

function createUserActionCrumbs(): Crumb[] {
  return [
    {
      color: 'gray300',
      data: {url: 'https://dev.getsentry.net:7999/organizations/sentry/performance/'},
      description: 'Default',
      id: 0,
      level: BreadcrumbLevelType.INFO,
      message: 'Start recording',
      timestamp: '2022-05-11T22:41:32.002Z',
      type: BreadcrumbType.INIT,
    },
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
}

describe('getPrevUserAction', function () {
  it(`should return the previous user action even if the timestamp
    is closer to the next action`, function () {
    const crumbs = createUserActionCrumbs();
    const results = getPrevUserAction({
      crumbs,
      startTimestamp: START_TIMESTAMP_SEC,
      currentHoverTime: CURRENT_TIME_MS,
    });

    expect(results?.id).toEqual(4);
  });

  it('should return undefined when userActions is not defined', function () {
    const crumbs = [];
    const results = getPrevUserAction({
      crumbs,
      startTimestamp: START_TIMESTAMP_SEC,
      currentHoverTime: CURRENT_TIME_MS,
    });

    expect(results).toBeUndefined();
  });

  it('should return undefined when startTimestamp is not defined or is equal to 0', function () {
    const crumbs = createUserActionCrumbs();
    const results = getPrevUserAction({
      crumbs,
      startTimestamp: 0,
      currentHoverTime: CURRENT_TIME_MS,
    });

    expect(results).toBeUndefined();
  });

  it('should return undefined when userActions has only item and the current time is before that item', function () {
    const crumbs = createUserActionCrumbs().slice(4, 5);
    const results = getPrevUserAction({
      crumbs,
      startTimestamp: START_TIMESTAMP_SEC,
      currentHoverTime: CURRENT_TIME_MS,
    });

    expect(results).toBeUndefined();
  });

  it('should return the user action when timestamp matches the timestamp of a breadcrumb', function () {
    const crumbs = createUserActionCrumbs();
    const exactCrumbTime: number = 8135;
    const results = getPrevUserAction({
      crumbs,
      startTimestamp: START_TIMESTAMP_SEC,
      currentHoverTime: exactCrumbTime,
    });

    expect(results?.id).toEqual(3);
  });
});
