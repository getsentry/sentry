import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  ErrorDot,
  ErrorLevel,
  ErrorMessageContent,
  ErrorTitle,
} from 'sentry/components/performance/waterfall/rowDetails';
import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {t} from 'sentry/locale';
import type {Group, Organization} from 'sentry/types';
import type {TraceErrorOrIssue} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery} from 'sentry/utils/queryClient';

type Props = {
  issue: TraceErrorOrIssue;
  organization: Organization;
};

function Issue(props: Props) {
  const {
    isLoading,
    data: fetchedIssue,
    isError,
  } = useApiQuery<Group>(
    [
      `/issues/${props.issue.issue_id}/`,
      {
        query: {
          collapse: 'release',
          expand: 'inbox',
        },
      },
    ],
    {
      staleTime: 2 * 60 * 1000,
    }
  );

  return isLoading ? (
    <LoadingIndicator size={20} mini />
  ) : fetchedIssue ? (
    <ErrorMessageContent key={fetchedIssue.id}>
      <ErrorDot level={fetchedIssue.level} />
      <ErrorLevel>{fetchedIssue.level}</ErrorLevel>
      <ErrorTitle>
        <Link to={generateIssueEventTarget(props.issue, props.organization)}>
          {fetchedIssue.title}
        </Link>
      </ErrorTitle>
    </ErrorMessageContent>
  ) : isError ? (
    <LoadingError message={t('Failed to download attachment.')} />
  ) : null;
}

export default Issue;
