import {Group} from 'sentry/types';
import {getIssueFieldRenderer} from 'sentry/utils/dashboards/issueFieldRenderers';
import {TableData} from 'sentry/utils/discover/discoverQuery';

import {ISSUE_FIELD_TO_HEADER_MAP} from '../widgetBuilder/issueWidget/fields';

import {DatasetConfig} from './base';

export const IssuesConfig: DatasetConfig<never, Group[]> = {
  getCustomFieldRenderer: getIssueFieldRenderer,
  fieldHeaderMap: ISSUE_FIELD_TO_HEADER_MAP,
  transformTable: (_data: Group[]) => {
    return {data: []} as TableData;
  },
};
