import Alert from 'app/components/alert';
import Button from 'app/components/button';
import LoadingError from 'app/components/loadingError';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import {Group, Organization, Project} from 'app/types';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

type ErrorCode =
  | 'issue_not_hierarchical'
  | 'project_not_hierarchical'
  | 'no_events'
  | 'merged_issues'
  | 'missing_feature';

type Error = {
  status: number;
  responseJSON?: {
    detail: {
      code: ErrorCode;
      extra: Record<string, any>;
      message: string;
    };
  };
};

type Props = {
  error: Error | string;
  groupId: Group['id'];
  orgSlug: Organization['slug'];
  projSlug: Project['slug'];
  onRetry: () => void;
};

function ErrorMessage({error, groupId, onRetry, orgSlug, projSlug}: Props) {
  function getErrorDetails(errorCode: ErrorCode) {
    switch (errorCode) {
      case 'merged_issues':
        return {
          title: t('An issue can only contain one fingerprint'),
          subTitle: t(
            'This issue needs to be fully unmerged before grouping levels can be shown'
          ),
          action: (
            <Button
              priority="primary"
              to={`/organizations/sentry/issues/${groupId}/merged/?${location.search}`}
            >
              {t('Unmerge issue')}
            </Button>
          ),
        };
      case 'missing_feature':
        return {
          title: t('This project does not have the grouping tree feature'),
        };

      case 'no_events':
        return {
          title: t('This issue has no events'),
        };
      case 'issue_not_hierarchical':
        return {
          title: t('Grouping breakdown is not available in this issue'),
          subTitle: t(
            'Only new issues with the latest grouping strategy have this feature available'
          ),
        };
      case 'project_not_hierarchical':
        return {
          title: t(
            'Grouping Breakdown is not avaialable in the current grouping strategy'
          ),
          subTitle: t(
            'You can upgrade grouping to the latest strategy. Note that this is an irreversible operation'
          ),
          action: (
            <Button
              priority="primary"
              to={`/settings/${orgSlug}/projects/${projSlug}/issue-grouping/`}
            >
              {t('Upgrade Grouping Strategy')}
            </Button>
          ),
        };
      default:
        return {};
    }
  }

  if (typeof error === 'string') {
    return <Alert type="warning">{error}</Alert>;
  }

  if (error.status === 403 && error.responseJSON?.detail) {
    const {code, message} = error.responseJSON.detail;
    const {action, title, subTitle} = getErrorDetails(code);

    return (
      <Panel>
        <EmptyMessage
          size="large"
          title={title ?? message}
          description={subTitle}
          action={action}
        />
      </Panel>
    );
  }

  return (
    <LoadingError
      message={t('Unable to load grouping levels, please try again later')}
      onRetry={onRetry}
    />
  );
}

export default ErrorMessage;
