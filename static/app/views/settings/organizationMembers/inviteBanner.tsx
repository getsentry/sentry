import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openInviteMissingMembersModal} from 'sentry/actionCreators/modal';
import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Card from 'sentry/components/card';
import Carousel from 'sentry/components/carousel';
import {openConfirmModal} from 'sentry/components/confirm';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconCommit, IconEllipsis, IconGithub, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MissingMember, Organization, OrgRole} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import withOrganization from 'sentry/utils/withOrganization';

const MAX_MEMBERS_TO_SHOW = 5;

type Props = {
  allowedRoles: OrgRole[];
  onModalClose: () => void;
  onSendInvite: () => void;
  organization: Organization;
};

export function InviteBanner({
  organization,
  allowedRoles,
  onSendInvite,
  onModalClose,
}: Props) {
  const isEligibleForBanner =
    organization.access.includes('org:write') && organization.githubNudgeInvite;
  const [sendingInvite, setSendingInvite] = useState<boolean>(false);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [missingMembers, setMissingMembers] = useState<MissingMember[]>(
    [] as MissingMember[]
  );

  const api = useApi();
  // NOTE: this is currently used for Github only
  const promptsFeature = `github_missing_members`;
  const location = useLocation();

  const snoozePrompt = useCallback(async () => {
    trackAnalytics('github_invite_banner.snoozed', {
      organization,
    });
    setShowBanner(false);
    await promptsUpdate(api, {
      organization,
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

  const fetchMissingMembers = useCallback(async () => {
    try {
      const data = await api.requestPromise(
        `/organizations/${organization.slug}/missing-members/`,
        {
          method: 'GET',
        }
      );
      const githubMissingMembers = data?.filter(
        (integrationMissingMembers: any) =>
          integrationMissingMembers.integration === 'github'
      )[0];
      setMissingMembers(githubMissingMembers?.users || []);
    } catch (err) {
      if (err.status !== 403) {
        addErrorMessage(t('Unable to fetching missing commit authors'));
      }
    }
  }, [api, organization]);

  useEffect(() => {
    if (!isEligibleForBanner) {
      return;
    }
    fetchMissingMembers();
    promptsCheck(api, {
      organization,
      feature: promptsFeature,
    }).then(prompt => {
      setShowBanner(!promptIsDismissed(prompt));
    });
  }, [api, organization, promptsFeature, isEligibleForBanner, fetchMissingMembers]);

  useEffect(() => {
    const {inviteMissingMembers} = qs.parse(location.search);

    if (isEligibleForBanner && inviteMissingMembers) {
      openInviteModal();
    }
  }, [openInviteModal, location, isEligibleForBanner]);

  if (isEligibleForBanner && showBanner && missingMembers.length > 0) {
    trackAnalytics('github_invite_banner.viewed', {
      organization,
      members_shown: missingMembers.slice(0, MAX_MEMBERS_TO_SHOW).length,
      total_members: missingMembers.length,
    });
  }
  if (!isEligibleForBanner || !showBanner || missingMembers.length === 0) {
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
    try {
      await api.requestPromise(
        `/organizations/${organization.slug}/members/?referrer=github_nudge_invite`,
        {
          method: 'POST',
          data: {email},
        }
      );
      addSuccessMessage(tct('Sent invite to [email]', {email}));
      onSendInvite();
      const updatedMissingMembers = missingMembers.filter(
        member => member.email !== email
      );
      setMissingMembers(updatedMissingMembers);
    } catch {
      addErrorMessage(t('Error sending invite'));
    }
    setSendingInvite(false);
  };

  return (
    <Fragment>
      {/* this is temporary to collect feedback about the banner */}
      <FloatingFeedbackWidget />
      <StyledCard>
        <CardTitleContainer>
          <CardTitleContent>
            <CardTitle>{t('Bring your full GitHub team on board in Sentry')}</CardTitle>
            <Subtitle>
              {tct('[missingMemberCount] missing members', {
                missingMemberCount: missingMembers.length,
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
            <Button
              priority="primary"
              size="xs"
              onClick={openInviteModal}
              analyticsEventName="Github Invite Banner: View All"
              analyticsEventKey="github_invite_banner.view_all"
            >
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
        <Carousel>
          <MemberCards
            missingMembers={missingMembers}
            handleSendInvite={handleSendInvite}
            openInviteModal={openInviteModal}
          />
        </Carousel>
      </StyledCard>
    </Fragment>
  );
}

export default withOrganization(InviteBanner);

type MemberCardsProps = {
  handleSendInvite: (email: string) => void;
  missingMembers: MissingMember[];
  openInviteModal: () => void;
};

function MemberCards({
  missingMembers,
  handleSendInvite,
  openInviteModal,
}: MemberCardsProps) {
  return (
    <Fragment>
      {missingMembers.slice(0, MAX_MEMBERS_TO_SHOW).map(member => {
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
              <MemberEmail>{member.email}</MemberEmail>
            </MemberCardContent>
            <Button
              size="sm"
              onClick={() => handleSendInvite(member.email)}
              data-test-id="invite-missing-member"
              icon={<IconMail />}
              analyticsEventName="Github Invite Banner: Invite"
              analyticsEventKey="github_invite_banner.invite"
            >
              {t('Invite')}
            </Button>
          </MemberCard>
        );
      })}

      <MemberCard data-test-id="see-more-card" key="see-more">
        <MemberCardContent>
          <MemberCardContentRow>
            <SeeMore>
              {tct('See all [missingMembersCount] missing members', {
                missingMembersCount: missingMembers.length,
              })}
            </SeeMore>
          </MemberCardContentRow>
          <Subtitle>
            {tct('Accounting for [totalCommits] recent commits', {
              totalCommits: missingMembers.reduce(
                (acc, curr) => acc + curr.commitCount,
                0
              ),
            })}
          </Subtitle>
        </MemberCardContent>
        <Button
          size="sm"
          priority="primary"
          onClick={openInviteModal}
          analyticsEventName="Github Invite Banner: View All"
          analyticsEventKey="github_invite_banner.view_all"
        >
          {t('View All')}
        </Button>
      </MemberCard>
    </Fragment>
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
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.gray400};
`;

const Subtitle = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.gray300};
  gap: ${space(0.5)};
`;

const MemberEmail = styled('div')`
  display: block;
  max-width: 70%;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.gray300};
  text-overflow: ellipsis;
  overflow: hidden;
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
  min-width: 50%;
  max-width: 75%;
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
