import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import {SectionHeading} from 'app/components/charts/styles';
import {IconWarning} from 'app/icons';
import GroupChart from 'app/components/stream/groupChart';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import SeenByList from 'app/components/seenByList';
import ShortId from 'app/components/shortId';
import Times from 'app/components/group/times';
import space from 'app/styles/space';
import {Group} from 'app/types';

type Props = {
  groupId: string;
  eventId: string;
};

type State = {
  group: Group;
};

class LinkedIssue extends AsyncComponent<
  Props & AsyncComponent['props'],
  State & AsyncComponent['state']
> {
  static propTypes = {
    groupId: PropTypes.string.isRequired,
    eventId: PropTypes.string.isRequired,
  };

  getEndpoints(): Array<[string, string]> {
    const {groupId} = this.props;
    const groupUrl = `/issues/${groupId}/`;

    return [['group', groupUrl]];
  }

  renderLoading() {
    return <Placeholder height="120px" bottomGutter={2} />;
  }

  renderError(error?: Error, disableLog = false, disableReport = false): React.ReactNode {
    const {errors} = this.state;
    const hasNotFound = Object.values(errors).find(resp => resp && resp.status === 404);
    if (hasNotFound) {
      return (
        <Alert type="warning" icon={<IconWarning size="md" />}>
          {t('The linked issue cannot be found. It may have been deleted, or merged.')}
        </Alert>
      );
    }

    return super.renderError(error, disableLog, disableReport);
  }

  renderBody() {
    const {eventId} = this.props;
    const {group} = this.state;
    const issueUrl = `${group.permalink}events/${eventId}/`;

    return (
      <Section>
        <SectionHeading>{t('Event Issue')}</SectionHeading>
        <StyledIssueCard>
          <IssueCardHeader>
            <StyledLink to={issueUrl} data-test-id="linked-issue">
              <StyledShortId
                shortId={group.shortId}
                avatar={<ProjectBadge project={group.project} avatarSize={16} hideName />}
              />
            </StyledLink>
            <StyledSeenByList seenBy={group.seenBy} maxVisibleAvatars={5} />
          </IssueCardHeader>
          <IssueCardBody>
            <GroupChart statsPeriod="30d" data={group} height={56} />
          </IssueCardBody>
          <IssueCardFooter>
            <Times lastSeen={group.lastSeen} firstSeen={group.firstSeen} />
          </IssueCardFooter>
        </StyledIssueCard>
      </Section>
    );
  }
}

const Section = styled('div')`
  margin-bottom: ${space(4)};
`;

const StyledIssueCard = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const IssueCardHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1)};
`;

const StyledLink = styled(Link)`
  justify-content: flex-start;
`;

const IssueCardBody = styled('div')`
  background: ${p => p.theme.gray200};
  padding-top: ${space(1)};
`;

const StyledSeenByList = styled(SeenByList)`
  margin: 0;
`;

const StyledShortId = styled(ShortId)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray700};
`;

const IssueCardFooter = styled('div')`
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeSmall};
  padding: ${space(0.5)} ${space(1)};
`;

export default LinkedIssue;
