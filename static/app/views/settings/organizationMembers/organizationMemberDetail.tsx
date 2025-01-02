import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';

import {removeAuthenticator} from 'sentry/actionCreators/account';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {resendMemberInvite, updateMember} from 'sentry/actionCreators/members';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {DateTime} from 'sentry/components/dateTime';
import NotFound from 'sentry/components/errors/notFound';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Tooltip} from 'sentry/components/tooltip';
import {IconRefresh} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Member} from 'sentry/types/organization';
import isMemberDisabledFromLimit from 'sentry/utils/isMemberDisabledFromLimit';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import Teams from 'sentry/utils/teams';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TeamSelectForMember from 'sentry/views/settings/components/teamSelect/teamSelectForMember';

import OrganizationRoleSelect from './inviteMember/orgRoleSelect';

const MULTIPLE_ORGS = t('Cannot be reset since user is in more than one organization');
const NOT_ENROLLED = t('Not enrolled in two-factor authentication');
const NO_PERMISSION = t('You do not have permission to perform this action');
const TWO_FACTOR_REQUIRED = t(
  'Cannot be reset since two-factor is required for this organization'
);

const DisabledMemberTooltip = HookOrDefault({
  hookName: 'component:disabled-member-tooltip',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

function MemberStatus({
  member,
  memberDeactivated,
}: {
  member: Member;
  memberDeactivated: boolean;
}) {
  if (memberDeactivated) {
    return (
      <em>
        <DisabledMemberTooltip>{t('Deactivated')}</DisabledMemberTooltip>
      </em>
    );
  }
  if (member.expired) {
    return <em>{t('Invitation Expired')}</em>;
  }
  if (member.pending) {
    return <em>{t('Invitation Pending')}</em>;
  }
  return t('Active');
}

const getMemberQueryKey = (orgSlug: string, memberId: string): ApiQueryKey => [
  `/organizations/${orgSlug}/members/${memberId}/`,
];

function OrganizationMemberDetailContent({member}: {member: Member}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const navigate = useNavigate();

  const [orgRole, setOrgRole] = useState<Member['orgRole']>('');
  const [teamRoles, setTeamRoles] = useState<Member['teamRoles']>([]);
  const hasTeamRoles = organization.features.includes('team-roles');

  useEffect(() => {
    if (member) {
      setOrgRole(member.orgRole);
      setTeamRoles(member.teamRoles);
    }
  }, [member]);

  const {mutate: updatedMember, isPending: isSaving} = useMutation<Member, RequestError>({
    mutationFn: () => {
      return updateMember(api, {
        orgId: organization.slug,
        memberId: member.id,
        data: {orgRole, teamRoles} as any,
      });
    },
    onMutate: () => {
      addLoadingMessage(t('Saving\u2026'));
    },
    onSuccess: data => {
      addSuccessMessage(t('Saved'));
      setApiQueryData<Member>(
        queryClient,
        getMemberQueryKey(organization.slug, member.id),
        data
      );
    },
    onError: error => {
      addErrorMessage(
        (error?.responseJSON?.detail as string) ?? t('Failed to update member')
      );
    },
  });

  const {mutate: inviteMember, isPending: isInviting} = useMutation<Member, RequestError>(
    {
      mutationFn: () => {
        return resendMemberInvite(api, {
          orgId: organization.slug,
          memberId: member.id,
          regenerate: true,
        });
      },
      onSuccess: data => {
        addSuccessMessage(t('Sent invite!'));

        setApiQueryData<Member>(
          queryClient,
          getMemberQueryKey(organization.slug, member.id),
          data
        );
      },
      onError: () => {
        addErrorMessage(t('Could not send invite'));
      },
    }
  );

  const {mutate: reset2fa, isPending: isResetting2fa} = useMutation<unknown>({
    mutationFn: () => {
      const {user} = member;
      const promises =
        user?.authenticators?.map(auth => removeAuthenticator(api, user.id, auth.id)) ??
        [];
      return Promise.all(promises);
    },
    onSuccess: () => {
      addSuccessMessage(t('All authenticators have been removed'));
      navigate(`/settings/${organization.slug}/members/`);
    },
    onError: error => {
      addErrorMessage(t('Error removing authenticators'));
      Sentry.captureException(error);
    },
  });

  const onAddTeam = (teamSlug: string) => {
    const newTeamRoles = [...teamRoles];
    const i = newTeamRoles.findIndex(r => r.teamSlug === teamSlug);
    if (i !== -1) {
      return;
    }

    newTeamRoles.push({teamSlug, role: null});
    setTeamRoles(newTeamRoles);
  };

  const onRemoveTeam = (teamSlug: string) => {
    const newTeamRoles = teamRoles.filter(r => r.teamSlug !== teamSlug);
    setTeamRoles(newTeamRoles);
  };

  const onChangeTeamRole = (teamSlug: string, role: string) => {
    if (!hasTeamRoles) {
      return;
    }

    const newTeamRoles = [...teamRoles];
    const i = newTeamRoles.findIndex(r => r.teamSlug === teamSlug);
    if (i === -1) {
      return;
    }

    newTeamRoles[i] = {...newTeamRoles[i]!, role};
    setTeamRoles(newTeamRoles);
  };

  const showResetButton = useMemo(() => {
    const {user} = member;

    if (!user || !user.authenticators || organization.require2FA) {
      return false;
    }
    const hasAuth = user.authenticators.length >= 1;
    return hasAuth && user.canReset2fa;
  }, [member, organization.require2FA]);

  const getTooltip = (): string => {
    const {user} = member;

    if (!user) {
      return '';
    }

    if (!user.authenticators) {
      return NO_PERMISSION;
    }
    if (!user.authenticators.length) {
      return NOT_ENROLLED;
    }
    if (!user.canReset2fa) {
      return MULTIPLE_ORGS;
    }
    if (organization.require2FA) {
      return TWO_FACTOR_REQUIRED;
    }

    return '';
  };

  function hasFormChanged() {
    if (!member) {
      return false;
    }

    if (orgRole !== member.orgRole || !isEqual(teamRoles, member.teamRoles)) {
      return true;
    }

    return false;
  }

  const memberDeactivated = isMemberDisabledFromLimit(member);
  const canEdit = organization.access.includes('org:write') && !memberDeactivated;
  const isPartnershipUser = member.flags['partnership:restricted'] === true;

  const {email, expired, pending} = member;
  const canResend = !expired;
  const showAuth = !pending;

  const showResendButton = (member.pending || member.expired) && canResend;

  return (
    <Fragment>
      <SentryDocumentTitle title={t('%s Member Settings', member.name || member.email)} />
      <SettingsPageHeader
        title={
          <Fragment>
            <div>{member.name}</div>
            <ExtraHeaderText>{t('Member Settings')}</ExtraHeaderText>
          </Fragment>
        }
      />

      <Panel>
        <PanelHeader hasButtons={showResendButton}>
          {t('Basics')}

          {showResendButton && (
            <Button
              data-test-id="resend-invite"
              size="xs"
              priority="primary"
              icon={<IconRefresh />}
              title={t('Generate a new invite link and send a new email.')}
              busy={isInviting}
              onClick={() => inviteMember()}
            >
              {t('Resend Invite')}
            </Button>
          )}
        </PanelHeader>

        <PanelBody>
          <PanelItem>
            <Details>
              <div>
                <DetailLabel>{t('Email')}</DetailLabel>
                <div>
                  <ExternalLink href={`mailto:${email}`}>{email}</ExternalLink>
                </div>
              </div>
              <div>
                <DetailLabel>{t('Status')}</DetailLabel>
                <div data-test-id="member-status">
                  <MemberStatus member={member} memberDeactivated={memberDeactivated} />
                </div>
              </div>
              <div>
                <DetailLabel>{t('Added')}</DetailLabel>
                <div>
                  <DateTime dateOnly date={member.dateCreated} />
                </div>
              </div>
            </Details>
          </PanelItem>
        </PanelBody>
      </Panel>

      {showAuth && (
        <Panel>
          <PanelHeader>{t('Authentication')}</PanelHeader>
          <PanelBody>
            <FieldGroup
              alignRight
              flexibleControlStateSize
              label={t('Reset two-factor authentication')}
              help={t(
                'Resetting two-factor authentication will remove all two-factor authentication methods for this member.'
              )}
            >
              <Tooltip disabled={showResetButton} title={getTooltip()}>
                <Confirm
                  disabled={!showResetButton}
                  message={tct(
                    'Are you sure you want to disable all two-factor authentication methods for [name]?',
                    {name: member.name ? member.name : 'this member'}
                  )}
                  onConfirm={() => reset2fa()}
                >
                  <Button priority="danger" busy={isResetting2fa}>
                    {t('Reset two-factor authentication')}
                  </Button>
                </Confirm>
              </Tooltip>
            </FieldGroup>
          </PanelBody>
        </Panel>
      )}

      <OrganizationRoleSelect
        enforceAllowed={false}
        enforceRetired={hasTeamRoles}
        disabled={!canEdit || isPartnershipUser}
        roleList={organization.orgRoleList}
        roleSelected={orgRole}
        setSelected={(newOrgRole: Member['orgRole']) => {
          setOrgRole(newOrgRole);
        }}
        helpText={
          isPartnershipUser
            ? t('You cannot make changes to this partner-provisioned user.')
            : undefined
        }
      />

      <Teams slugs={member.teams}>
        {({initiallyLoaded}) => (
          <TeamSelectForMember
            disabled={!canEdit}
            organization={organization}
            member={member}
            selectedOrgRole={orgRole}
            selectedTeamRoles={teamRoles}
            onChangeTeamRole={onChangeTeamRole}
            onAddTeam={onAddTeam}
            onRemoveTeam={onRemoveTeam}
            loadingTeams={!initiallyLoaded}
          />
        )}
      </Teams>

      <Footer>
        <Button
          priority="primary"
          busy={isSaving}
          onClick={() => updatedMember()}
          disabled={!canEdit || !hasFormChanged()}
        >
          {t('Save Member')}
        </Button>
      </Footer>
    </Fragment>
  );
}

function OrganizationMemberDetail() {
  const params = useParams<{memberId: string}>();
  const organization = useOrganization();

  const {
    data: member,
    isPending,
    isError,
    refetch,
  } = useApiQuery<Member>(getMemberQueryKey(organization.slug, params.memberId), {
    staleTime: 0,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (!member) {
    return <NotFound />;
  }

  return <OrganizationMemberDetailContent member={member} />;
}

export default OrganizationMemberDetail;

const ExtraHeaderText = styled('div')`
  color: ${p => p.theme.gray300};
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeLarge};
`;

const Details = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-template-columns: 2fr 1fr 1fr;
  gap: ${space(2)};
  width: 100%;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-auto-flow: row;
    grid-template-columns: auto;
  }
`;

const DetailLabel = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${space(0.5)};
  color: ${p => p.theme.textColor};
`;

const Footer = styled('div')`
  display: flex;
  justify-content: flex-end;
`;
