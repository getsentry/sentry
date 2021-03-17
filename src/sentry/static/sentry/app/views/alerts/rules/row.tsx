import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';
import memoize from 'lodash/memoize';
import moment from 'moment';

import Access from 'app/components/acl/access';
import Feature from 'app/components/acl/feature';
import ActorAvatar from 'app/components/avatar/actorAvatar';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import ErrorBoundary from 'app/components/errorBoundary';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import {IconDelete, IconSettings, IconUser} from 'app/icons';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Actor, Organization, Project} from 'app/types';
import {IssueAlertRule} from 'app/types/alerts';

import {isIssueAlert} from '../utils';

type Props = {
  rule: IssueAlertRule;
  projects: Project[];
  projectsLoaded: boolean;
  orgId: string;
  organization: Organization;
  onDelete: (projectId: string, rule: IssueAlertRule) => void;
  // Set of team ids that the user belongs to
  userTeams: Set<string>;
};

type State = {};

class RuleListRow extends React.Component<Props, State> {
  /**
   * Memoized function to find a project from a list of projects
   */
  getProject = memoize((slug: string, projects: Project[]) =>
    projects.find(project => project.slug === slug)
  );

  render() {
    const {
      rule,
      projectsLoaded,
      projects,
      organization,
      orgId,
      onDelete,
      userTeams,
    } = this.props;
    const dateCreated = moment(rule.dateCreated).format('ll');
    const slug = rule.projects[0];
    const editLink = `/organizations/${orgId}/alerts/${
      isIssueAlert(rule) ? 'rules' : 'metric-rules'
    }/${slug}/${rule.id}/`;

    const hasRedesign =
      !isIssueAlert(rule) && organization.features.includes('alert-details-redesign');
    const detailsLink = `/organizations/${orgId}/alerts/rules/details/${rule.id}/`;

    const ownerId = rule.owner?.split(':')[1];
    const teamActor = ownerId
      ? {type: 'team' as Actor['type'], id: ownerId, name: ''}
      : null;

    const canEdit = ownerId ? userTeams.has(ownerId) : true;

    return (
      <ErrorBoundary>
        <RuleType>{isIssueAlert(rule) ? t('Issue') : t('Metric')}</RuleType>
        <Title>
          <Link to={hasRedesign ? detailsLink : editLink}>{rule.name}</Link>
        </Title>
        <ProjectBadge
          avatarSize={18}
          project={!projectsLoaded ? {slug} : this.getProject(slug, projects)}
        />
        <Feature features={['organizations:team-alerts-ownership']}>
          <TeamIcon>
            {teamActor ? (
              <ActorAvatar actor={teamActor} size={24} />
            ) : (
              <IconUser size="20px" color="gray400" />
            )}
          </TeamIcon>
        </Feature>
        <CreatedBy>{rule?.createdBy?.name ?? '-'}</CreatedBy>
        <div>{dateCreated}</div>
        <RightColumn>
          <Access access={['alerts:write']}>
            {({hasAccess}) => (
              <ButtonBar gap={1}>
                <Confirm
                  disabled={!hasAccess || !canEdit}
                  message={tct(
                    "Are you sure you want to delete [name]? You won't be able to view the history of this alert once it's deleted.",
                    {
                      name: rule.name,
                    }
                  )}
                  header={t('Delete Alert Rule?')}
                  priority="danger"
                  confirmText={t('Delete Rule')}
                  onConfirm={() => onDelete(slug, rule)}
                >
                  <Button
                    type="button"
                    icon={<IconDelete />}
                    size="small"
                    title={t('Delete')}
                  />
                </Confirm>
                <Button
                  size="small"
                  type="button"
                  icon={<IconSettings />}
                  title={t('Edit')}
                  to={editLink}
                />
              </ButtonBar>
            )}
          </Access>
        </RightColumn>
      </ErrorBoundary>
    );
  }
}

const columnCss = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  height: 100%;
`;

const RightColumn = styled('div')`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: ${space(1.5)} ${space(2)};
`;

const RuleType = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 400;
  color: ${p => p.theme.gray300};
  text-transform: uppercase;
  ${columnCss}
`;

const Title = styled('div')`
  ${overflowEllipsis}
  ${columnCss}
`;

const CreatedBy = styled('div')`
  ${overflowEllipsis}
  ${columnCss}
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

const TeamIcon = styled('div')`
  display: flex;
  align-items: center;
`;

export default RuleListRow;
