import {IssueCategory} from 'sentry/types/group';

export const INBOX_AUTOFIX_CATEGORY_FILTER = ` issue.category:[${[
  IssueCategory.ERROR,
  IssueCategory.MOBILE,
  IssueCategory.FRONTEND,
  IssueCategory.DB_QUERY,
  IssueCategory.HTTP_CLIENT,
  IssueCategory.CONFIGURATION,
].join(',')}]`;
