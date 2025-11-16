import {t} from 'sentry/locale';
import {IssueType} from 'sentry/types/group';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

const codeQualityConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      archiveUntilOccurrence: {enabled: false},
      delete: {enabled: true},
      deleteAndDiscard: {enabled: false},
      merge: {enabled: false},
      ignore: {enabled: true},
      resolve: {enabled: true},
      resolveInRelease: {enabled: true},
      share: {enabled: true},
    },
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: true},
      tagsTab: {enabled: true},
    },
    usesIssuePlatform: true,
    issueSummary: {enabled: true},
    stacktrace: {enabled: false},
  },
  [IssueType.CODE_COVERAGE_GAP]: {
    resources: {
      description: t(
        'This pull request introduces code that lacks sufficient test coverage.'
      ),
      links: [],
      linksByPlatform: {},
    },
  },
  [IssueType.BUILD_SIZE_MOBILE]: {
    resources: {
      description: t(
        'This pull request significantly increases the mobile app build size.'
      ),
      links: [],
      linksByPlatform: {},
    },
  },
};

export default codeQualityConfig;
