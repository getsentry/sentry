import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {openInviteMissingMembersModal} from 'sentry/actionCreators/modal';
import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Card from 'sentry/components/card';
import Carousel from 'sentry/components/carousel';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconCommit, IconEllipsis, IconGithub, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MissingMember, Organization, OrgRole} from 'sentry/types';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  allowedRoles: OrgRole[];
  missingMembers: {integration: string; users: MissingMember[]};
  onModalClose: () => void;
  onSendInvite: (email: string) => void;
  organization: Organization;
};

export function InviteBanner({
  missingMembers,
  onSendInvite,
  organization,
  allowedRoles,
  onModalClose,
}: Props) {
  // NOTE: this is currently used for Github only

  const hideBanner =
    !organization.features.includes('integrations-gh-invite') ||
    !organization.access.includes('org:write') ||
    !missingMembers?.users ||
    missingMembers?.users.length === 0;
  const [sendingInvite, setSendingInvite] = useState<boolean>(false);
  const [showBanner, setShowBanner] = useState<boolean>(false);

  const api = useApi();
  const integrationName = missingMembers?.integration;
  const promptsFeature = `${integrationName}_missing_members`;
  const location = useLocation();

  const snoozePrompt = useCallback(async () => {
    setShowBanner(false);
    await promptsUpdate(api, {
      organizationId: organization.id,
      feature: promptsFeature,
      status: 'snoozed',
    });
  }, [api, organization, promptsFeature]);

  const openInviteModal = useCallback(() => {
    openInviteMissingMembersModal({
      allowedRoles,
      missingMembers,
      organization,
      onClose: onModalClose,
    });
  }, [allowedRoles, missingMembers, organization, onModalClose]);

  useEffect(() => {
    if (hideBanner) {
      return;
    }
    promptsCheck(api, {
      organizationId: organization.id,
      feature: promptsFeature,
    }).then(prompt => {
      setShowBanner(!promptIsDismissed(prompt));
    });
  }, [api, organization, promptsFeature, hideBanner]);

  useEffect(() => {
    const {inviteMissingMembers} = qs.parse(location.search);

    if (!hideBanner && inviteMissingMembers) {
      openInviteModal();
    }
  }, [openInviteModal, location, hideBanner]);

  if (hideBanner || !showBanner) {
    return null;
  }

  // TODO(cathy): include docs link
  const menuItems: MenuItemProps[] = [
    {
      key: 'invite-banner-snooze',
      label: t('Hide Missing Members'),
      onAction: () => {
        openConfirmModal({
          message: t('Are you sure you want to snooze this banner?'),
          onConfirm: snoozePrompt,
        });
      },
    },
  ];

  const handleSendInvite = async (email: string) => {
    if (sendingInvite) {
      return;
    }
    setSendingInvite(true);
    await onSendInvite(email);
    setSendingInvite(false);
  };

  const users = missingMembers.users;

  const cards = users.slice(0, 5).map(member => {
    const username = member.externalId.split(':').pop();
    return (
      <MemberCard
        key={member.externalId}
        data-test-id={`member-card-${member.externalId}`}
      >
        <MemberCardContent>
          <MemberCardContentRow>
            <IconGithub size="sm" />
            {/* TODO(cathy): create mapping from integration to lambda external link function */}
            <StyledExternalLink href={`https://github.com/${username}`}>
              @{username}
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
    );
  });

  cards.push(
    <SeeMoreCard
      key="see-more"
      missingMembers={missingMembers}
      openInviteModal={openInviteModal}
    />
  );

  return (
    <StyledCard>
      <CardTitleContainer>
        <CardTitleContent>
          <CardTitle>{t('Bring your full GitHub team on board in Sentry')}</CardTitle>
          <Subtitle>
            {tct('[missingMemberCount] missing members', {
              missingMemberCount: users.length,
            })}
            <QuestionTooltip
              title={t(
                "Based on the last 30 days of GitHub commit data, there are team members committing code to Sentry projects that aren't in your Sentry organization"
              )}
              size="xs"
            />
          </Subtitle>
        </CardTitleContent>
        <ButtonBar gap={1}>
          <Button priority="primary" size="xs" onClick={openInviteModal}>
            {t('View All')}
          </Button>
          <DropdownMenu
            items={menuItems}
            triggerProps={{
              size: 'xs',
              showChevron: false,
              icon: <IconEllipsis direction="down" size="sm" />,
              'aria-label': t('Actions'),
            }}
          />
        </ButtonBar>
      </CardTitleContainer>
      <Carousel>{cards}</Carousel>
    </StyledCard>
  );
}

export default withOrganization(InviteBanner);

type SeeMoreCardProps = {
  missingMembers: {integration: string; users: MissingMember[]};
  openInviteModal: () => void;
};

function SeeMoreCard({missingMembers, openInviteModal}: SeeMoreCardProps) {
  const {users} = missingMembers;

  return (
    <MemberCard data-test-id="see-more-card">
      <MemberCardContent>
        <MemberCardContentRow>
          <SeeMore>
            {tct('See all [missingMembersCount] missing members', {
              missingMembersCount: users.length,
            })}
          </SeeMore>
        </MemberCardContentRow>
        <Subtitle>
          {tct('Accounting for [totalCommits] recent commits', {
            totalCommits: users.reduce((acc, curr) => acc + curr.commitCount, 0),
          })}
        </Subtitle>
      </MemberCardContent>
      <Button size="sm" priority="primary" onClick={openInviteModal}>
        {t('View All')}
      </Button>
    </MemberCard>
  );
}

const StyledCard = styled(Card)`
  display: flex;
  padding: ${space(2)};
  padding-bottom: ${space(1.5)};
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

const CardTitle = styled('h6')`
  margin: 0;
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: bold;
  color: ${p => p.theme.gray400};
`;

export const Subtitle = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 400;
  color: ${p => p.theme.gray300};
  gap: ${space(0.5)};
`;

const MemberCard = styled(Card)`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  min-width: 30%;
  margin: ${space(1)} ${space(0.5)} 0 0;
  padding: ${space(2)} 18px;
  justify-content: center;
  align-items: center;
`;

const MemberCardContent = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1;
  width: 75%;
`;

const MemberCardContentRow = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(0.25)};
  font-size: ${p => p.theme.fontSizeSmall};
  gap: ${space(0.75)};
`;

export const StyledExternalLink = styled(ExternalLink)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const SeeMore = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
`;
