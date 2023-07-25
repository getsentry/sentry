import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Card from 'sentry/components/card';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCommit, IconEllipsis, IconGithub, IconInfo, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MissingMember} from 'sentry/types';

type Props = {
  missingMembers: MissingMember[];
  onSendInvite: (email: string) => void;
  // organization: Organization;
};

export function InviteBanner({missingMembers, onSendInvite}: Props) {
  // TODO(cathy): include docs link and snooze option

  const menuItems: MenuItemProps[] = [
    {
      key: 'invite-banner-snooze',
      label: t('Hide Missing Members'),
      priority: 'default',
      onAction: () => {
        openConfirmModal({
          message: t('Are you sure you want to snooze this banner?'),
          onConfirm: () => true,
        });
      },
    },
  ];

  const cards = missingMembers.slice(0, 4).map(member => (
    <MemberCard key={member.userId} data-test-id={`member-card-${member.userId}`}>
      <MemberCardContent>
        <MemberCardContentRow>
          <IconGithub size="sm" />
          <StyledExternalLink href={`http://github.com/${member.userId}`}>
            {tct('@[userId]', {userId: member.userId})}
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
        onClick={() => onSendInvite(member.email)}
        data-test-id="invite-missing-member"
        icon={<IconMail />}
      >
        {t('Invite')}
      </Button>
    </MemberCard>
  ));

  cards.push(
    <MemberCard key="see-more" data-test-id="see-more-card">
      <MemberCardContent>
        <MemberCardContentRow>
          <SeeMoreContainer>
            {tct('See all [missingMembersCount] missing members', {
              missingMembersCount: missingMembers.length,
            })}
          </SeeMoreContainer>
        </MemberCardContentRow>
        <Subtitle>
          {tct('Accounting for [totalCommits] missing commits', {
            totalCommits: missingMembers?.reduce(
              (acc, curr) => acc + curr.commitCount,
              0
            ),
          })}
        </Subtitle>
      </MemberCardContent>
      <Button
        size="sm"
        priority="primary"
        // onClick={() => onSendInvite(member.email)}
        data-test-id="view-all-missing-members"
      >
        {t('View All')}
      </Button>
    </MemberCard>
  );

  return (
    <StyledCard>
      <CardTitleContainer>
        <CardTitleContent>
          <CardTitle>{t('Bring your full GitHub team on board in Sentry')}</CardTitle>
          <Subtitle>
            {tct('[missingMemberCount] missing members that are active in your GitHub', {
              missingMemberCount: missingMembers.length,
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
            // onClick={}
            data-test-id="view-all-missing-members"
          >
            {t('View All')}
          </Button>
          <DropdownMenu
            items={menuItems}
            trigger={triggerProps => (
              <Button
                {...triggerProps}
                aria-label={t('Actions')}
                size="xs"
                icon={<IconEllipsis direction="down" size="sm" />}
                data-test-id="edit-dropdown"
              />
            )}
          />
        </ButtonContainer>
      </CardTitleContainer>
      <MemberCardsContainer>{cards}</MemberCardsContainer>
    </StyledCard>
  );
}

export default InviteBanner;

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
  min-width: 330px;
  justify-content: space-between;
`;

const MemberCardsContainer = styled('div')`
  display: flex;
  overflow-x: scroll;
`;

const MemberCardContent = styled('div')`
  display: flex;
  flex-direction: column;
  width: 75%;
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

const SeeMoreContainer = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
`;
