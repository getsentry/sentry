import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Member, Organization} from 'sentry/types';
import {getEffectiveOrgRole} from 'sentry/utils/orgRole';

export const OrgRoleInfo = ({
  organization,
  member,
}: {
  member: Member;
  organization: Organization;
}) => {
  const {orgRoleList} = organization;
  const {orgRole, orgRolesFromTeams} = member;

  const orgRoleFromMember = useMemo(() => {
    const role = orgRoleList.find(r => r.id === orgRole);
    return role;
  }, [orgRole, orgRoleList]);

  const effectiveOrgRoleId = useMemo(() => {
    const memberOrgRoles = orgRolesFromTeams.map(r => r.role.id);
    if (orgRoleFromMember) {
      memberOrgRoles.concat(orgRoleFromMember.id);
    }
    return getEffectiveOrgRole(memberOrgRoles, orgRoleList);
  }, [orgRoleFromMember, orgRolesFromTeams, orgRoleList]);

  const effectiveOrgRole = useMemo(() => {
    return orgRoleList.find(r => r.id === effectiveOrgRoleId);
  }, [orgRoleList, effectiveOrgRoleId]);

  if (!orgRoleFromMember || !effectiveOrgRole) {
    addErrorMessage(t('Missing member org role'));
    return <Fragment>{t('None')}</Fragment>;
  }

  if (!orgRolesFromTeams || orgRolesFromTeams.length === 0) {
    return <Fragment>{orgRoleFromMember.name}</Fragment>;
  }

  const urlPrefix = `/settings/${organization.slug}/`;

  const tooltipBody = (
    <TooltipWrapper>
      <div>{t('This user recieved org-level roles from several sources.')}</div>

      <ListWrapper>
        <TeamRow>
          <TeamLink to={`${urlPrefix}member/${member.id}/`}>
            {t('User-specific')}
          </TeamLink>
          <div>: {orgRoleFromMember.name}</div>
        </TeamRow>

        <br />

        <div>{t('Teams:')}</div>
        {orgRolesFromTeams
          .sort((a, b) => a.teamSlug.localeCompare(b.teamSlug))
          .map(r => (
            <TeamRow key={r.teamSlug}>
              <TeamLink to={`${urlPrefix}teams/${r.teamSlug}/`}>#{r.teamSlug}</TeamLink>
              <div>: {r.role.name}</div>
            </TeamRow>
          ))}
      </ListWrapper>

      <div>
        {t(
          'Sentry will grant them permissions equivalent to the union-set of all their role.'
        )}{' '}
        <ExternalLink href="https://docs.sentry.io/product/accounts/membership/#roles">
          {t('See docs here')}
        </ExternalLink>
        .
      </div>
    </TooltipWrapper>
  );

  return (
    <Wrapper>
      {effectiveOrgRole.name}
      <Tooltip isHoverable title={tooltipBody}>
        <IconInfo />
      </Tooltip>
    </Wrapper>
  );
};

const Wrapper = styled('span')`
  display: inline;

  > :last-child {
    vertical-align: middle;
    margin: 0 ${space(0.5)};
  }
`;

const TooltipWrapper = styled('div')`
  width: 200px;
  display: grid;
  row-gap: ${space(1.5)};
  text-align: left;
  overflow: hidden;
`;
const ListWrapper = styled('div')`
  display: block;
`;

const TeamRow = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;

  > * {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
const TeamLink = styled(Link)`
  max-width: 130px;
  font-weight: 700;
`;
