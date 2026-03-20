import {useState} from 'react';
import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';

import {BannerContainer, BannerSummary} from 'sentry/components/events/styles';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import type {GroupActivityReprocess} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {localStorageWrapper} from 'sentry/utils/localStorage';

type Props = {
  groupCount: number;
  groupId: string;
  orgSlug: Organization['slug'];
  reprocessActivity: GroupActivityReprocess;
  className?: string;
};

export function ReprocessedBox({
  orgSlug,
  reprocessActivity,
  groupCount,
  className,
  groupId,
}: Props) {
  const getBannerUniqueId = () => {
    const {id} = reprocessActivity;

    return `reprocessed-activity-${id}-banner-dismissed`;
  };

  const [isBannerHidden, setIsBannerHidden] = useState<boolean>(
    localStorageWrapper.getItem(getBannerUniqueId()) === 'true'
  );

  const handleBannerDismiss = () => {
    localStorageWrapper.setItem(getBannerUniqueId(), 'true');
    setIsBannerHidden(true);
  };

  const renderMessage = () => {
    const {data} = reprocessActivity;
    const {eventCount, oldGroupId, newGroupId} = data;

    const reprocessedEventsRoute = `/organizations/${orgSlug}/issues/?query=reprocessing.original_issue_id:${oldGroupId}&referrer=reprocessed-activity`;

    if (groupCount === 0) {
      return tct('All events in this issue were moved during reprocessing. [link]', {
        link: (
          <Link to={reprocessedEventsRoute}>
            {tn('See %s new event', 'See %s new events', eventCount)}
          </Link>
        ),
      });
    }

    return tct('Events in this issue were successfully reprocessed. [link]', {
      link: (
        <Link to={reprocessedEventsRoute}>
          {newGroupId === Number(groupId)
            ? tn('See %s reprocessed event', 'See %s reprocessed events', eventCount)
            : tn('See %s new event', 'See %s new events', eventCount)}
        </Link>
      ),
    });
  };

  if (isBannerHidden) {
    return null;
  }

  return (
    <BannerContainer priority="success" className={className}>
      <StyledBannerSummary>
        <IconCheckmark variant="success" />
        <span>{renderMessage()}</span>
        <StyledIconClose
          variant="success"
          aria-label={t('Dismiss')}
          onClick={handleBannerDismiss}
        />
      </StyledBannerSummary>
    </BannerContainer>
  );
}

const StyledBannerSummary = styled(BannerSummary)`
  & > svg:last-child {
    margin-right: 0;
    margin-left: ${p => p.theme.space.md};
  }
`;

const StyledIconClose = styled(IconClose)`
  cursor: pointer;
`;
