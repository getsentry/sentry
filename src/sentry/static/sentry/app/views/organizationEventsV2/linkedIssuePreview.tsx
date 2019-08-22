import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import GroupChart from 'app/components/stream/groupChart';
import InlineSvg from 'app/components/inlineSvg';
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

class LinkedIssuePreview extends AsyncComponent<
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

  renderBody() {
    const {eventId} = this.props;
    const {group} = this.state;
    const issueUrl = `${group.permalink}events/${eventId}/`;

    return (
      <Container>
        <Title>
          <InlineSvg src="icon-link" size="12px" /> {t('Linked Issue')}
        </Title>
        <Section>
          <Link to={issueUrl} data-test-id="linked-issue">
            <StyledShortId
              shortId={group.shortId}
              avatar={<ProjectBadge project={group.project} avatarSize={16} hideName />}
            />
          </Link>
          <StyledSeenByList seenBy={group.seenBy} maxVisibleAvatars={5} />
        </Section>
        <ChartContainer>
          <GroupChart id={group.id} statsPeriod="30d" data={group} height={48} />
        </ChartContainer>
        <TimesSection>
          <Times lastSeen={group.lastSeen} firstSeen={group.firstSeen} />
        </TimesSection>
      </Container>
    );
  }
}

const Container = styled('div')`
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(2)};
  position: relative;
`;

const Title = styled('h4')`
  background: #fff;
  color: ${p => p.theme.gray3};
  padding: 0 ${space(0.5)};

  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: normal;

  top: -${space(1)};
  left: ${space(1)};
  position: absolute;
`;

const Section = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: ${space(1)};
`;

const ChartContainer = styled('div')`
  border-top: 1px solid ${p => p.theme.borderLight};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background: ${p => p.theme.offWhite};
  position: relative;
`;

const StyledSeenByList = styled(SeenByList)`
  margin: 0;
`;

const StyledShortId = styled(ShortId)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const TimesSection = styled(Section)`
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default LinkedIssuePreview;
