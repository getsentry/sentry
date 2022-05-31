import {getIssueFieldRenderer} from 'sentry/utils/dashboards/issueFieldRenderers';

import {ISSUE_FIELD_TO_HEADER_MAP} from '../widgetBuilder/issueWidget/fields';

import {DatasetConfig} from './base';

export const IssuesConfig: DatasetConfig = {
  customFieldRenderer: getIssueFieldRenderer,
  fieldHeaderMap: ISSUE_FIELD_TO_HEADER_MAP,
};
