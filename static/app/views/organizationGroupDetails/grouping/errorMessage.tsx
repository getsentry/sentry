import React from 'react';

import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import LoadingError from 'app/components/loadingError';
import {Panel} from 'app/components/panels';
import {t, tct} from 'app/locale';
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
          title: t('Grouping breakdown is not available in this issue'),
          subTitle: t(
            'This issue needs to be fully unmerged before grouping breakdown is available'
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
          title: t('Update your Grouping Config'),
          subTitle: (
            <React.Fragment>
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
            </React.Fragment>
          ),
          leftAligned: true,
          action: (
            <ButtonBar gap={1}>
              <Button
                priority="primary"
                to={`/settings/${orgSlug}/projects/${projSlug}/issue-grouping/#upgrade-grouping`}
              >
                {t('Upgrade Grouping Config')}
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
    return <Alert type="warning">{error}</Alert>;
  }

  if (error.status === 403 && error.responseJSON?.detail) {
    const {code, message} = error.responseJSON.detail;
    const {action, title, subTitle, leftAligned} = getErrorDetails(code);

    return (
      <Panel>
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
    />
  );
}

export default ErrorMessage;
