import {Fragment} from 'react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Member, Organization} from 'sentry/types';
import {sortOrgRoles} from 'sentry/utils/orgRole';

export const OrgRoleInfo = ({
  organization,
  member,
}: {
  member: Member;
  organization: Organization;
}) => {
  const {orgRoleList} = organization;
  const {orgRole, orgRolesFromTeams} = member;

  const orgRoleFromMember = orgRoleList.find(r => r.id === orgRole);
  if (!orgRoleFromMember) {
    throw new Error();
  }

  if (!orgRolesFromTeams || orgRolesFromTeams.length === 0) {
    return <Fragment>{orgRoleFromMember.name}</Fragment>;
  }

  const topOrgRoleId = sortOrgRoles(
    orgRolesFromTeams.map(r => r.role.id).concat([orgRoleFromMember.id]),
    orgRoleList
  )[0];
  const topOrgRole = orgRoleList.find(r => r.id === topOrgRoleId);
  if (!topOrgRole) {
    throw new Error();
  }

  const urlPrefix = `/settings/${organization.slug}/`;

  const node = (
    <RoleTooltip>
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
          'Sentry will grant them permissions equivalent to their highest org-level role.'
        )}{' '}
        <ExternalLink href="https://docs.sentry.io/product/accounts/membership/#roles">
          See docs here
        </ExternalLink>
        .
      </div>
    </RoleTooltip>
  );

  return (
    <Wrapper>
      {topOrgRole.name}
      <Tooltip isHoverable title={node}>
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

const RoleTooltip = styled('div')`
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
