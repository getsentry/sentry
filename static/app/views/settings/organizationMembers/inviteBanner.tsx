import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Card from 'sentry/components/card';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCommit, IconGithub, IconInfo, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MissingMember, Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  missingMembers: {integration: string; users: MissingMember[]};
  onSendInvite: (email: string) => Promise<void>;
  organization: Organization;
};

export function InviteBanner({missingMembers, onSendInvite, organization}: Props) {
  // NOTE: this is currently used for Github only
  // TODO(cathy): include snoozing, docs link
  const [sendingInvite, setSendingInvite] = useState<boolean>(false);

  if (
    !organization.access.includes('org:write') ||
    !missingMembers?.users ||
    missingMembers?.users.length === 0
  ) {
    return null;
  }

  const handleSendInvite = async (email: string) => {
    if (sendingInvite) {
      return;
    }
    setSendingInvite(true);
    await onSendInvite(email);
    setSendingInvite(false);
  };

  const users = missingMembers.users;

  const cards = users.slice(0, 5).map(member => (
    <MemberCard key={member.externalId} data-test-id={`member-card-${member.externalId}`}>
      <MemberCardContent>
        <MemberCardContentRow>
          <IconGithub size="sm" />
          {/* TODO: create mapping from integration to lambda external link function */}
          <StyledExternalLink href={`http://github.com/${member.externalId}`}>
            {tct('@[externalId]', {externalId: member.externalId})}
          </StyledExternalLink>
        </MemberCardContentRow>
        <MemberCardContentRow>
          <IconCommit size="xs" />
          {tct('[commitCount] Recent Commits', {commitCount: member.commitCount})}
        </MemberCardContentRow>
        <Subtitle>{member.email}</Subtitle>
      </MemberCardContent>
      <Button
        size="sm"
        onClick={() => handleSendInvite(member.email)}
        data-test-id="invite-missing-member"
        icon={<IconMail />}
      >
        {t('Invite')}
      </Button>
    </MemberCard>
  ));

  cards?.push(<SeeMoreCard key="see-more" missingUsers={users} />);

  return (
    <StyledCard data-test-id="invite-banner">
      <CardTitleContainer>
        <CardTitleContent>
          <CardTitle>{t('Bring your full GitHub team on board in Sentry')}</CardTitle>
          <Subtitle>
            {tct('[missingMemberCount] missing members that are active in your GitHub', {
              missingMemberCount: users.length,
            })}
            <Tooltip title="Based on the last 30 days of commit data">
              <IconInfo size="xs" />
            </Tooltip>
          </Subtitle>
        </CardTitleContent>
        <ButtonContainer>
          <Button
            priority="primary"
            size="xs"
            // TODO(cathy): open up invite modal
            data-test-id="view-all-missing-members"
          >
            {t('View All')}
          </Button>
        </ButtonContainer>
      </CardTitleContainer>
      <MemberCardsContainer>{cards}</MemberCardsContainer>
    </StyledCard>
  );
}

export default withOrganization(InviteBanner);

type SeeMoreCardProps = {
  missingUsers: MissingMember[];
};

function SeeMoreCard({missingUsers}: SeeMoreCardProps) {
  return (
    <MemberCard data-test-id="see-more-card">
      <MemberCardContent>
        <MemberCardContentRow>
          <SeeMore>
            {tct('See all [missingMembersCount] missing members', {
              missingMembersCount: missingUsers.length,
            })}
          </SeeMore>
        </MemberCardContentRow>
        <Subtitle>
          {tct('Accounting for [totalCommits] recent commits', {
            totalCommits: missingUsers.reduce((acc, curr) => acc + curr.commitCount, 0),
          })}
        </Subtitle>
      </MemberCardContent>
      <Button
        size="sm"
        priority="primary"
        // TODO(cathy): open up invite modal
        data-test-id="view-all-missing-members"
      >
        {t('View All')}
      </Button>
    </MemberCard>
  );
}

const StyledCard = styled(Card)`
  padding: ${space(2)};
  display: flex;
  overflow: hidden;
`;

const CardTitleContainer = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const CardTitleContent = styled('div')`
  display: flex;
  flex-direction: column;
`;

const CardTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: bold;
  color: ${p => p.theme.gray400};
`;

const Subtitle = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 400;
  color: ${p => p.theme.gray300};
  display: flex;
  align-items: center;
  & > *:first-child {
    margin-left: ${space(0.5)};
    display: flex;
    align-items: center;
  }
`;

const ButtonContainer = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-column-gap: ${space(1)};
`;

const MemberCard = styled(Card)`
  padding: ${space(2)} 18px;
  display: flex;
  flex-direction: row;
  align-items: center;
  margin: ${space(1)} ${space(0.5)} 0 0;
  min-width: 30%;
  justify-content: center;
  flex-wrap: wrap;
`;

const MemberCardsContainer = styled('div')`
  position: relative;
  display: flex;
  overflow-x: scroll;
`;

const MemberCardContent = styled('div')`
  display: flex;
  flex-direction: column;
  width: 75%;
  flex: 1 1;
`;

const MemberCardContentRow = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  & > *:first-child {
    margin-right: ${space(0.75)};
  }
  margin-bottom: ${space(0.25)};
`;

const StyledExternalLink = styled(ExternalLink)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const SeeMore = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
`;
