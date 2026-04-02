import {DateTime} from 'sentry/components/dateTime';
import {Duration} from 'sentry/components/duration';
import {BannerContainer, BannerSummary} from 'sentry/components/events/styles';
import {t} from 'sentry/locale';
import type {Group, IgnoredStatusDetails} from 'sentry/types/group';
import {GroupSubstatus} from 'sentry/types/group';

interface ArchivedBoxProps {
  statusDetails: IgnoredStatusDetails;
  substatus: Group['substatus'];
}

export function renderArchiveReason({substatus, statusDetails}: ArchivedBoxProps) {
  const {ignoreUntil, ignoreCount, ignoreWindow, ignoreUserCount, ignoreUserWindow} =
    statusDetails;

  if (substatus === GroupSubstatus.ARCHIVED_UNTIL_ESCALATING) {
    return t('This issue has been archived until it escalates.');
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

export function ArchivedBox({substatus, statusDetails}: ArchivedBoxProps) {
  return (
    <BannerContainer priority="default">
      <BannerSummary>
        <span>{renderArchiveReason({substatus, statusDetails})}</span>
      </BannerSummary>
    </BannerContainer>
  );
}
