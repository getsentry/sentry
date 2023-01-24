import {Fragment} from 'react';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EmptyMessage from 'sentry/components/emptyMessage';
import FeatureBadge from 'sentry/components/featureBadge';
import LoadingError from 'sentry/components/loadingError';
import {Panel} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import {Group, Organization, Project} from 'sentry/types';

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
  hasProjectWriteAccess: boolean;
  onRetry: () => void;
  orgSlug: Organization['slug'];
  projSlug: Project['slug'];
  className?: string;
};

function ErrorMessage({
  error,
  groupId,
  onRetry,
  orgSlug,
  projSlug,
  hasProjectWriteAccess,
  className,
}: Props) {
  function getErrorDetails(errorCode: ErrorCode) {
    switch (errorCode) {
      case 'merged_issues':
        return {
          title: t('Grouping breakdown is not available in this issue'),
          subTitle: t(
            'This issue needs to be fully unmerged before grouping breakdown is available'
          ),
          action: (
            <Button
              priority="primary"
              to={`/organizations/${orgSlug}/issues/${groupId}/merged/?${location.search}`}
            >
              {t('Unmerge issue')}
            </Button>
          ),
        };
      case 'missing_feature':
        return {
          title: t(
            'This project does not have the grouping breakdown available. Is your organization still an early adopter?'
          ),
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
          title: (
            <Fragment>
              {t('Update your Grouping Config')}
              <FeatureBadge type="beta" />
            </Fragment>
          ),
          subTitle: (
            <Fragment>
              <p>
                {t(
                  'Enable advanced grouping insights and functionality by updating this project to the latest Grouping Config:'
                )}
              </p>

              <ul>
                <li>
                  {tct(
                    '[strong:Breakdowns:] Explore events in this issue by call hierarchy.',
                    {strong: <strong />}
                  )}
                </li>
                <li>
                  {tct(
                    '[strong:Stack trace annotations:] See important frames Sentry uses to group issues directly in the stack trace.',
                    {strong: <strong />}
                  )}
                </li>
              </ul>
            </Fragment>
          ),
          leftAligned: true,
          action: (
            <ButtonBar gap={1}>
              <Button
                priority="primary"
                to={`/settings/${orgSlug}/projects/${projSlug}/issue-grouping/#upgrade-grouping`}
                disabled={!hasProjectWriteAccess}
                title={
                  !hasProjectWriteAccess
                    ? t('You do not have permission to update this project')
                    : undefined
                }
              >
                {t('Upgrade Grouping Strategy')}
              </Button>
              <Button href="https://docs.sentry.io/product/data-management-settings/event-grouping/grouping-breakdown/">
                {t('Read the docs')}
              </Button>
            </ButtonBar>
          ),
        };
      default:
        return {};
    }
  }

  if (typeof error === 'string') {
    return (
      <Alert type="warning" className={className}>
        {error}
      </Alert>
    );
  }

  if (error.status === 403 && error.responseJSON?.detail) {
    const {code, message} = error.responseJSON.detail;
    const {action, title, subTitle, leftAligned} = getErrorDetails(code);

    return (
      <Panel className={className}>
        <EmptyMessage
          size="large"
          title={title ?? message}
          description={subTitle}
          action={action}
          leftAligned={leftAligned}
        />
      </Panel>
    );
  }

  return (
    <LoadingError
      message={t('Unable to load grouping levels, please try again later')}
      onRetry={onRetry}
      className={className}
    />
  );
}

export default ErrorMessage;
