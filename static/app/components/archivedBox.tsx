import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import {BannerContainer, BannerSummary} from 'sentry/components/events/styles';
import ExternalLink from 'sentry/components/links/externalLink';
import {t} from 'sentry/locale';
import type {Group, IgnoredStatusDetails} from 'sentry/types/group';
import {GroupSubstatus} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';

interface ArchivedBoxProps {
  organization: Organization;
  statusDetails: IgnoredStatusDetails;
  substatus: Group['substatus'];
  hasStreamlinedUI?: boolean;
}

export function renderArchiveReason({
  substatus,
  statusDetails,
  organization,
  hasStreamlinedUI = false,
}: ArchivedBoxProps) {
  const {ignoreUntil, ignoreCount, ignoreWindow, ignoreUserCount, ignoreUserWindow} =
    statusDetails;

  if (substatus === GroupSubstatus.ARCHIVED_UNTIL_ESCALATING) {
    return hasStreamlinedUI
      ? t('This issue has been archived until it escalates.')
      : t(
          "This issue has been archived. It'll return to your inbox if it escalates. To learn more, %s",
          <ExternalLink
            href="https://docs.sentry.io/product/issues/states-triage/#archive"
            onClick={() =>
              trackAnalytics('issue_details.issue_status_docs_clicked', {organization})
            }
          >
            {t('read the docs')}
          </ExternalLink>
        );
  }
  if (ignoreUntil) {
    return t(
      'This issue has been archived until %s.',
      <strong>
        <DateTime date={ignoreUntil} />
      </strong>
    );
  }
  if (ignoreCount && ignoreWindow) {
    return t(
      'This issue has been archived until it occurs %s time(s) in %s.',
      <strong>{ignoreCount.toLocaleString()}</strong>,
      <strong>
        <Duration seconds={ignoreWindow * 60} />
      </strong>
    );
  }
  if (ignoreCount) {
    return t(
      'This issue has been archived until it occurs %s more time(s).',
      <strong>{ignoreCount.toLocaleString()}</strong>
    );
  }
  if (ignoreUserCount && ignoreUserWindow) {
    return t(
      'This issue has been archived until it affects %s user(s) in %s.',
      <strong>{ignoreUserCount.toLocaleString()}</strong>,
      <strong>
        <Duration seconds={ignoreUserWindow * 60} />
      </strong>
    );
  }
  if (ignoreUserCount) {
    return t(
      'This issue has been archived until it affects %s more user(s).',
      <strong>{ignoreUserCount.toLocaleString()}</strong>
    );
  }

  return t('This issue has been archived forever.');
}
function ArchivedBox({substatus, statusDetails, organization}: ArchivedBoxProps) {
  return (
    <BannerContainer priority="default">
      <BannerSummary>
        <span>{renderArchiveReason({substatus, statusDetails, organization})}</span>
      </BannerSummary>
    </BannerContainer>
  );
}

export default ArchivedBox;
