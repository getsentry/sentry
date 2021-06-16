import Button from 'app/components/button';
import LoadingError from 'app/components/loadingError';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import {Group} from 'app/types';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

type ErrorCode = 'not_hierarchical' | 'no_events' | 'merged_issues' | 'missing_feature';

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
  error: Error;
  groupId: Group['id'];
  onRetry: () => void;
};

function ErrorMessage({error, groupId, onRetry}: Props) {
  function getErrorMessage(errorCode: ErrorCode) {
    switch (errorCode) {
      case 'merged_issues':
        return {
          title: t('An issue can only contain one fingerprint'),
          subTitle: t(
            'This issue needs to be fully unmerged before grouping levels can be shown'
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
      case 'not_hierarchical':
        return {
          title: t('This issue does not have hierarchical grouping'),
        };
      default:
        return undefined;
    }
  }

  if (error.status === 403 && error.responseJSON?.detail) {
    const {code, message} = error.responseJSON.detail;
    const errorMessage = getErrorMessage(code);

    return (
      <Panel>
        <EmptyMessage
          size="large"
          title={errorMessage?.title ?? message}
          description={errorMessage?.subTitle}
          action={
            code === 'merged_issues' ? (
              <Button
                priority="primary"
                to={`/organizations/sentry/issues/${groupId}/merged/?${location.search}`}
              >
                {t('Unmerge issue')}
              </Button>
            ) : undefined
          }
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
