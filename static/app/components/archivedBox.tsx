import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import {BannerContainer, BannerSummary} from 'sentry/components/events/styles';
import ExternalLink from 'sentry/components/links/externalLink';
import {t} from 'sentry/locale';
import type {ResolutionStatusDetails} from 'sentry/types';

type Props = {
  statusDetails: ResolutionStatusDetails;
};

function ArchivedBox({statusDetails}: Props) {
  function renderReason() {
    const {
      ignoreUntil,
      ignoreCount,
      ignoreWindow,
      ignoreUserCount,
      ignoreUserWindow,
      ignoreUntilEscalating,
    } = statusDetails;

    if (ignoreUntilEscalating) {
      return t(
        "This issue has been archived. It'll return to your inbox if it escalates. To learn more, %s",
        <ExternalLink href="https://docs.sentry.io/product/issues/states-triage/">
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

  return (
    <BannerContainer priority="default">
      <BannerSummary>
        <span>{renderReason()}</span>
      </BannerSummary>
    </BannerContainer>
  );
}

export default ArchivedBox;
