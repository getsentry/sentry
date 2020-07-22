import React from 'react';
import moment from 'moment';
import styled from '@emotion/styled';

import {IconDelete, IconSettings} from 'app/icons';
import {PanelItem} from 'app/components/panels';
import {IssueAlertRule} from 'app/types/alerts';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ErrorBoundary from 'app/components/errorBoundary';
import Projects from 'app/utils/projects';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

import {IncidentStats} from '../types';
import {TableLayout} from './styles';

type Props = {
  rule: IssueAlertRule;
  projects: Parameters<React.ComponentProps<typeof Projects>['children']>[0]['projects'];
  projectsLoaded: boolean;
  orgId: string;
} & AsyncComponent['props'];

type State = {
  stats: IncidentStats;
} & AsyncComponent['state'];

class RuleListRow extends React.Component<Props, State> {
  /**
   * Memoized function to find a project from a list of projects
   */
  //   getProject = memoize((slug, projects) =>
  //     projects.find(project => project.slug === slug)
  //   );

  render() {
    const {rule} = this.props;
    // const {error, stats} = this.state;
    const created = moment(rule.dateCreated).format('ll');
    // const slug = incident.projects[0];

    return (
      <ErrorBoundary>
        <IncidentPanelItem>
          <TableLayout>
            <div>Metric</div>
            <Title>{rule.name}</Title>
            <div>All</div>

            {/* <ProjectBadge
              avatarSize={18}
              project={!projectsLoaded ? {slug} : this.getProject(slug, projects)}
            /> */}

            <div>Marshawn Lynch</div>
            <div>{created}</div>
            <Actions>
              <Button size="small" icon={<IconDelete />} />
              <Button size="small" icon={<IconSettings />} />
            </Actions>
          </TableLayout>
        </IncidentPanelItem>
      </ErrorBoundary>
    );
  }
}

const Title = styled('span')`
  ${overflowEllipsis}
`;

const IncidentPanelItem = styled(PanelItem)`
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1.5)} ${space(2)};
`;

const Actions = styled('div')`
  > button:not(:last-child) {
    margin-right: ${space(1)};
  }
`;

export default RuleListRow;
