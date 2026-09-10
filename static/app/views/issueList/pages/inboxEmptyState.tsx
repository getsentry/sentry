import {Fragment} from 'react';

import starryVoidImg from 'sentry-images/spot/starry-void.png';

import {Button, LinkButton} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';

import {IconClock} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export function InboxEmptyState({
  alternateInbox,
  assignmentFilter,
}: {
  assignmentFilter: string;
  alternateInbox?: {
    label: string;
    onClick: () => void;
  };
}) {
  const organization = useOrganization();

  return (
    <EmptyState
      padding="3xl"
      title={t('No Issues in your Inbox!')}
      description={t(
        'Inbox is a personalized view of issues relevant to you. Once an issue is assigned to you, it will appear here.'
      )}
      illustration={<img src={starryVoidImg} alt="" />}
      action={
        <Fragment>
          <LinkButton
            to={`/organizations/${organization.slug}/issues/`}
            icon={<IconClock />}
            analyticsEventKey="issue_inbox.go_to_issue_feed_clicked"
            analyticsEventName="Issue Inbox: Go to Issue Feed Clicked"
            analyticsParams={{assignment_filter: assignmentFilter}}
          >
            {t('Go to Issue Feed')}
          </LinkButton>
          {alternateInbox && (
            <Button onClick={alternateInbox.onClick}>{alternateInbox.label}</Button>
          )}
        </Fragment>
      }
    />
  );
}
