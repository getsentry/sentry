import {DateTime} from 'sentry/components/dateTime';
import {Duration} from 'sentry/components/duration';
import {t, tct, tn} from 'sentry/locale';
import type {GroupActivitySetIgnored, IssueCategory} from 'sentry/types/group';
import {IssueCategory as IssueCategoryEnum} from 'sentry/types/group';

export function getArchiveDetails(
  data: GroupActivitySetIgnored['data'],
  issueCategory: IssueCategory
) {
  if (data.ignoreDuration) {
    return tct('for [duration]', {
      duration: <Duration seconds={data.ignoreDuration * 60} />,
    });
  }

  if (data.ignoreCount && data.ignoreWindow) {
    return tct('until [threshold] within [duration]', {
      threshold: tn('%s event occurs', '%s events occur', data.ignoreCount),
      duration: <Duration seconds={data.ignoreWindow * 60} />,
    });
  }

  if (data.ignoreCount) {
    return tn(
      'until %s more event occurs',
      'until %s more events occur',
      data.ignoreCount
    );
  }

  if (data.ignoreUserCount && data.ignoreUserWindow) {
    return tct('until [threshold] within [duration]', {
      threshold: tn('%s user is affected', '%s users are affected', data.ignoreUserCount),
      duration: <Duration seconds={data.ignoreUserWindow * 60} />,
    });
  }

  if (data.ignoreUserCount) {
    return tn(
      'until %s more user is affected',
      'until %s more users are affected',
      data.ignoreUserCount
    );
  }

  if (data.ignoreUntil) {
    return tct('until [date]', {
      date: <DateTime date={data.ignoreUntil} />,
    });
  }

  if (data.ignoreUntilEscalating) {
    return t('until it escalates');
  }

  return issueCategory === IssueCategoryEnum.FEEDBACK ? null : t('forever');
}
