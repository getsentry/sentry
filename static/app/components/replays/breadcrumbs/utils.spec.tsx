import {getTitle} from 'sentry/components/replays/breadcrumbs/utils';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';

const crumbs = {
  replayInitCrumb: {
    type: BreadcrumbType.INIT,
    timestamp: new Date().toISOString(),
    level: BreadcrumbLevelType.INFO,
    message: 'https://example.com',
    data: {
      action: 'replay-init',
      label: 'Start recording',
      url: 'https://example.com',
    },
  },
  issueCrumb: {
    type: 'error',
    level: 'error',
    category: 'issue',
    message: 'NotFoundError: GET "/organizations/{orgSlug}/replays/1234/" 404',
    data: {
      label: 'ErrorNotFoundError',
      eventId: '0105d6f5a7844125b92824eb89ad1ae0',
      groupId: 3913420330,
      groupShortId: 'JAVASCRIPT-2DA7',
      project: 'javascript',
    },
    timestamp: '2023-05-01T20:44:20+00:00',
    id: 32,
    color: 'red300',
    description: 'Error',
  },

  navigation: TestStubs.ReplaySegmentNavigation({})[0].data.payload,
  console: TestStubs.ReplaySegmentConsole({})[0].data.payload,

  customCrumb: {
    timestamp: '2023-05-03T14:17:08.642Z',
    type: 'default',
    message: 'sending get request',
    data: {
      fromJs: true,
    },
    id: 1,
    color: 'gray300',
    description: 'Default',
    level: 'undefined',
  },
};

describe('utils', () => {
  describe('getTitle', () => {
    it.each([
      {crumbName: 'replayInitCrumb', expected: 'Start recording'},
      {crumbName: 'navigation', expected: 'navigation '},
      {crumbName: 'console', expected: 'console '},
      {crumbName: 'issueCrumb', expected: 'ErrorNotFoundError'},
      {crumbName: 'customCrumb', expected: 'sending get request'},
    ])('should return a reasonable title. [$crumbName]', ({crumbName, expected}) => {
      expect(getTitle(crumbs[crumbName])).toBe(expected);
    });
  });
});
