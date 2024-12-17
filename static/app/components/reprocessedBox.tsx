import {useState} from 'react';
import styled from '@emotion/styled';

import {BannerContainer, BannerSummary} from 'sentry/components/events/styles';
import Link from 'sentry/components/links/link';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {GroupActivityReprocess} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import localStorage from 'sentry/utils/localStorage';

type Props = {
  groupCount: number;
  groupId: string;
  orgSlug: Organization['slug'];
  reprocessActivity: GroupActivityReprocess;
  className?: string;
};

function ReprocessedBox({
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
    localStorage.getItem(getBannerUniqueId()) === 'true'
  );

  const handleBannerDismiss = () => {
    localStorage.setItem(getBannerUniqueId(), 'true');
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
        <IconCheckmark color="successText" isCircled />
        <span>{renderMessage()}</span>
        <StyledIconClose
          color="successText"
          aria-label={t('Dismiss')}
          isCircled
          onClick={handleBannerDismiss}
        />
      </StyledBannerSummary>
    </BannerContainer>
  );
}

export default ReprocessedBox;

const StyledBannerSummary = styled(BannerSummary)`
  & > svg:last-child {
    margin-right: 0;
    margin-left: ${space(1)};
  }
`;

const StyledIconClose = styled(IconClose)`
  cursor: pointer;
`;
