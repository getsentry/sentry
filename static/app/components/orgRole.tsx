import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Member, Organization} from 'sentry/types';
import {getEffectiveOrgRole} from 'sentry/utils/orgRole';

export function OrgRoleInfo({
  organization,
  member,
}: {
  member: Member;
  organization: Organization;
}) {
  const {orgRoleList} = organization;
  const {orgRole, groupOrgRoles} = member;

  const orgRoleFromMember = useMemo(() => {
    const role = orgRoleList.find(r => r.id === orgRole);
    return role;
  }, [orgRole, orgRoleList]);

  const effectiveOrgRole = useMemo(() => {
    if (!groupOrgRoles) {
      return orgRoleFromMember;
    }
    const memberOrgRoles = groupOrgRoles.map(r => r.role.id).concat([orgRole]);
    return getEffectiveOrgRole(memberOrgRoles, orgRoleList);
  }, [orgRole, groupOrgRoles, orgRoleList, orgRoleFromMember]);

  useEffect(() => {
    if (!orgRoleFromMember) {
      Sentry.withScope(scope => {
        scope.setExtra('context', {
          memberId: member.id,
          orgRole: member.orgRole,
        });
        Sentry.captureException(new Error('OrgMember has an invalid orgRole.'));
      });
    }
  }, [orgRoleFromMember, member]);

  useEffect(() => {
    if (!effectiveOrgRole) {
      Sentry.withScope(scope => {
        scope.setExtra('context', {
          memberId: member.id,
          orgRoleFromMember,
          groupOrgRoles,
          orgRoleList,
          effectiveOrgRole,
        });
        Sentry.captureException(new Error('OrgMember has no effectiveOrgRole.'));
      });
    }
  }, [effectiveOrgRole, member, orgRoleFromMember, groupOrgRoles, orgRoleList]);

  // This code path should not happen, so this weird UI is fine.
  if (!orgRoleFromMember) {
    return <Fragment>{t('Error Role')}</Fragment>;
  }

  if (groupOrgRoles?.length === 0 || !effectiveOrgRole || !groupOrgRoles) {
    return <Fragment>{orgRoleFromMember.name}</Fragment>;
  }

  const urlPrefix = `/settings/${organization.slug}/`;

  const tooltipBody = (
    <TooltipWrapper>
      <div>{t('This user recieved org-level roles from several sources.')}</div>

      <div>
        <TeamRow>
          <TeamLink to={`${urlPrefix}member/${member.id}/`}>
            {t('User-specific')}
          </TeamLink>
          <div>: {orgRoleFromMember.name}</div>
        </TeamRow>
      </div>

      <div>
        <div>{t('Teams')}:</div>
        {groupOrgRoles &&
          groupOrgRoles
            .sort((a, b) => a.teamSlug.localeCompare(b.teamSlug))
            .map(r => (
              <TeamRow key={r.teamSlug}>
                <TeamLink to={`${urlPrefix}teams/${r.teamSlug}/`}>#{r.teamSlug}</TeamLink>
                <div>: {r.role.name}</div>
              </TeamRow>
            ))}
      </div>

      <div>
        {tct(
          'Sentry will grant them permissions equivalent to the union-set of all their role. [docsLink:See docs here].',
          {
            docsLink: (
              <ExternalLink href="https://docs.sentry.io/product/accounts/membership/#roles" />
            ),
          }
        )}
      </div>
    </TooltipWrapper>
  );

  return (
    <Wrapper>
      {effectiveOrgRole.name}
      <QuestionTooltip isHoverable size="sm" title={tooltipBody} />
    </Wrapper>
  );
}

const Wrapper = styled('span')`
  display: inline-flex;
  gap: ${space(0.5)};
`;

const TooltipWrapper = styled('div')`
  width: 200px;
  display: grid;
  row-gap: ${space(1.5)};
  text-align: left;
  overflow: hidden;
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
