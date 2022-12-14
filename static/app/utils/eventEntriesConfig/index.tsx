import {IssueCategory} from 'sentry/types';
import errorConfig from 'sentry/utils/eventEntriesConfig/errorConfig';
import performanceConfig from 'sentry/utils/eventEntriesConfig/performanceConfig';
import {EventEntriesIssueTypeMapping} from 'sentry/utils/eventEntriesConfig/types';

type EventEntriesConfig = Record<IssueCategory, EventEntriesIssueTypeMapping>;

const groupEventConfig: EventEntriesConfig = {
  [IssueCategory.ERROR]: errorConfig,
  [IssueCategory.PERFORMANCE]: performanceConfig,
};

export default groupEventConfig;
