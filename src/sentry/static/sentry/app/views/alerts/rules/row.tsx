import React from 'react';
import moment from 'moment';
import styled from '@emotion/styled';
import memoize from 'lodash/memoize';

import {t, tct} from 'app/locale';
import {IconDelete, IconSettings} from 'app/icons';
import {PanelItem} from 'app/components/panels';
import {Project} from 'app/types';
import {IssueAlertRule} from 'app/types/alerts';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import ErrorBoundary from 'app/components/errorBoundary';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

import {isIssueAlert} from '../utils';
import {TableLayout} from './styles';

type Props = {
  rule: IssueAlertRule;
  projects: Project[];
  projectsLoaded: boolean;
  orgId: string;
  onDelete: (projectId: string, rule: IssueAlertRule) => void;
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
    const {rule, projectsLoaded, projects, orgId, onDelete} = this.props;
    const dateCreated = moment(rule.dateCreated).format('ll');
    const slug = rule.projects[0];
    const link = `/organizations/${orgId}/alerts/${
      isIssueAlert(rule) ? 'rules' : 'metric-rules'
    }/${slug}/${rule.id}/`;

    return (
      <ErrorBoundary>
        <AlertRulesPanelItem>
          <TableLayout>
            <RuleType>{isIssueAlert(rule) ? t('Issue') : t('Metric')}</RuleType>
            <Title>
              <Link to={link}>{rule.name}</Link>
            </Title>
            <ProjectBadge
              avatarSize={18}
              project={!projectsLoaded ? {slug} : this.getProject(slug, projects)}
            />
            <CreatedBy>{rule?.createdBy?.name ?? '-'}</CreatedBy>
            <div>{dateCreated}</div>
            <Access access={['project:write']}>
              {({hasAccess}) => (
                <ButtonBar gap={1}>
                  <Confirm
                    disabled={!hasAccess}
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
                    icon={<IconSettings />}
                    title={t('Edit')}
                    to={link}
                  />
                </ButtonBar>
              )}
            </Access>
          </TableLayout>
        </AlertRulesPanelItem>
      </ErrorBoundary>
    );
  }
}

const RuleType = styled('div')`
  font-size: 12px;
  font-weight: 400;
  color: ${p => p.theme.gray500};
  text-transform: uppercase;
`;

const Title = styled('div')`
  ${overflowEllipsis}
`;

const CreatedBy = styled('div')`
  ${overflowEllipsis}
`;

const AlertRulesPanelItem = styled(PanelItem)`
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1.5)} ${space(2)};
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

export default RuleListRow;
