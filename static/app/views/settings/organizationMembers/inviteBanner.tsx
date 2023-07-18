import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import Card from 'sentry/components/card';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCommit, IconEllipsis, IconGithub, IconInfo, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Member, MissingMember, Organization} from 'sentry/types';
import {useApiQuery, useMutation} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {organization: Organization};

type CreateMemberVariables = {email: string};

export function InviteBanner({organization}: Props) {
  // TODO(cathy): replace with call to get uninvited org members
  const api = useApi();
  const {data: missingMembers} = useApiQuery<Member[]>(
    [`/organizations/${organization.slug}/users/`],
    {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false,
      notifyOnChangeProps: ['data'],
    }
  );

  const {mutate} = useMutation<Member, RequestError, CreateMemberVariables>({
    mutationFn: ({email}: CreateMemberVariables) =>
      api.requestPromise(`/organizations/${organization.slug}/members/`, {
        method: 'POST',
        data: {email},
      }),
    onSuccess: response => {
      addSuccessMessage(`Successfully invited member ${response.email}`);
    },
  });

  const missingOrgMembers: MissingMember[] = [
    {email: 'hello@sentry.io', commitCount: 5, userId: 'hello'},
    {email: 'cathy.teng@sentry.io', commitCount: 10, userId: 'cathteng'},
    {email: 'test@sentry.io', commitCount: 234, userId: 'testy'},
    {email: 'test2@sentry.io', commitCount: 34, userId: 'test2'},
  ];

  // TODO(cathy): include docs link and snooze option
  const menuItems: MenuItemProps[] = [
    {
      key: 'invite-banner-snooze',
      label: t('Delete'),
      priority: 'default',
      onAction: () => {
        openConfirmModal({
          message: t('Are you sure you want to snooze this banner?'),
          onConfirm: () => {
            return true;
          },
        });
      },
    },
  ];

  const cards = missingOrgMembers.map(member => (
    <MemberCard key={member.userId}>
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
        onClick={() => mutate({email: member.email})}
        data-test-id="view-all-missing-members"
        icon={<IconMail />}
      >
        {t('Invite')}
      </Button>
    </MemberCard>
  ));

  return (
    <StyledCard>
      <CardTitleContainer>
        <CardTitleContent>
          <CardTitle>{t('Bring your full GitHub team on board in Sentry')}</CardTitle>
          <Subtitle>
            {tct('[missingMemberCount] missing members that are active in your GitHub', {
              missingMemberCount: missingOrgMembers.length,
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

export default withOrganization(InviteBanner);

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
`;

const MemberCardsContainer = styled('div')`
  display: flex;
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
