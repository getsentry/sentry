import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import {BannerContainer, BannerSummary} from 'sentry/components/events/styles';
import {IconMute} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ResolutionStatusDetails} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  statusDetails: ResolutionStatusDetails;
};

function MutedBox({statusDetails}: Props) {
  const organization = useOrganization();

  function renderReason() {
    const {ignoreUntil, ignoreCount, ignoreWindow, ignoreUserCount, ignoreUserWindow} =
      statusDetails;

    const hasEscalatingUi = organization.features.includes('escalating-issues-ui');
    const ignoredOrArchived = hasEscalatingUi ? t('Archived') : t('Ignored');

    if (ignoreUntil) {
      return t(
        'This issue has been %s until %s',
        ignoredOrArchived,
        <strong>
          <DateTime date={ignoreUntil} />
        </strong>
      );
    }
    if (ignoreCount && ignoreWindow) {
      return t(
        'This issue has been %s until it occurs %s time(s) in %s',
        ignoredOrArchived,
        <strong>{ignoreCount.toLocaleString()}</strong>,
        <strong>
          <Duration seconds={ignoreWindow * 60} />
        </strong>
      );
    }
    if (ignoreCount) {
      return t(
        'This issue has been %s until it occurs %s more time(s)',
        ignoredOrArchived,
        <strong>{ignoreCount.toLocaleString()}</strong>
      );
    }
    if (ignoreUserCount && ignoreUserWindow) {
      return t(
        'This issue has been %s until it affects %s user(s) in %s',
        ignoredOrArchived,
        <strong>{ignoreUserCount.toLocaleString()}</strong>,
        <strong>
          <Duration seconds={ignoreUserWindow * 60} />
        </strong>
      );
    }
    if (ignoreUserCount) {
      return t(
        'This issue has been %s until it affects %s more user(s)',
        ignoredOrArchived,
        <strong>{ignoreUserCount.toLocaleString()}</strong>
      );
    }

    return t('This issue has been %s', ignoredOrArchived);
  }

  return (
    <BannerContainer priority="default">
      <BannerSummary>
        <IconMute color="dangerText" size="sm" />
        <span>
          {renderReason()}&nbsp;&mdash;&nbsp;
          {t(
            'You will not be notified of any changes and it will not show up by default in feeds.'
          )}
        </span>
      </BannerSummary>
    </BannerContainer>
  );
}

export default MutedBox;
