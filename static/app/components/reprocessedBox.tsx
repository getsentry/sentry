import {Component} from 'react';
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
  groupId: string;
  orgSlug: Organization['slug'];
  className?: string;
};

type State = {
  isBannerHidden: boolean;
};

class ReprocessedBox extends Component<Props, State> {
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

  renderMessage() {
    const {orgSlug, reprocessActivity, groupCount, groupId} = this.props;
    const {data} = reprocessActivity;
    const {eventCount, oldGroupId, newGroupId} = data;

    const reprocessedEventsRoute = `/organizations/${orgSlug}/issues/?query=reprocessing.original_issue_id:${oldGroupId}`;

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
  }

  render() {
    const {isBannerHidden} = this.state;

    if (isBannerHidden) {
      return null;
    }

    const {className} = this.props;

    return (
      <BannerContainer priority="success" className={className}>
        <StyledBannerSummary>
          <IconCheckmark color="green300" isCircled />
          <span>{this.renderMessage()}</span>
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
