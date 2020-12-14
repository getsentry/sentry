import React from 'react';
import styled from '@emotion/styled';

import {BannerContainer, BannerSummary} from 'app/components/events/styles';
import Link from 'app/components/links/link';
import {IconCheckmark, IconClose} from 'app/icons';
import {t, tct, tn} from 'app/locale';
import space from 'app/styles/space';
import {GroupActivityReprocess, Organization} from 'app/types';
import localStorage from 'app/utils/localStorage';

type Props = {
  reprocessActivity: GroupActivityReprocess;
  groupCount: number;
  orgSlug: Organization['slug'];
  className?: string;
};

type State = {
  isBannerHidden: boolean;
};

class ReprocessedBox extends React.Component<Props, State> {
  state: State = {
    isBannerHidden: localStorage.getItem(this.getBannerUniqueId()) === 'true',
  };

  getBannerUniqueId() {
    const {reprocessActivity} = this.props;
    const {id} = reprocessActivity;

    return `reprocessed-activity-${id}-banner-dismissed`;
  }

  handleBannerDismiss = () => {
    localStorage.setItem(this.getBannerUniqueId(), 'true');
    this.setState({isBannerHidden: true});
  };

  render() {
    const {orgSlug, reprocessActivity, groupCount, className} = this.props;
    const {data} = reprocessActivity;
    const {eventCount, oldGroupId} = data;

    if (this.state.isBannerHidden) {
      return null;
    }

    const link = (
      <Link
        to={`/organizations/${orgSlug}/issues/?query=reprocessing.original_issue_id:${oldGroupId}`}
      >
        {tn('See %s new event', 'See %s new events', eventCount)}
      </Link>
    );

    return (
      <BannerContainer priority="success" className={className}>
        <StyledBannerSummary>
          <IconCheckmark color="green300" isCircled />
          <span>
            {groupCount === 0
              ? tct('All events in this issue were moved during reprocessing. [link]', {
                  link,
                })
              : tct('Events in this issue were successfully reprocessed. [link]', {link})}
          </span>
          <StyledIconClose
            color="green300"
            aria-label={t('Dismiss')}
            isCircled
            onClick={this.handleBannerDismiss}
          />
        </StyledBannerSummary>
      </BannerContainer>
    );
  }
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
