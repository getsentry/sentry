import React from 'react';
import memoize from 'lodash/memoize';
import moment from 'moment';
import styled from '@emotion/styled';

import {IconWarning} from 'app/icons';
import {PanelItem} from 'app/components/panels';
import {t, tct} from 'app/locale';
import {IssueAlertRule} from 'app/types/alerts';
import AsyncComponent from 'app/components/asyncComponent';
import DateTime from 'app/components/dateTime';
import Duration from 'app/components/duration';
import ErrorBoundary from 'app/components/errorBoundary';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import Projects from 'app/utils/projects';
import theme from 'app/utils/theme';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import getDynamicText from 'app/utils/getDynamicText';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

import {IncidentStats} from '../types';
import {TableLayout} from './styles';

type Props = {
  rule: IssueAlertRule;
  projects: Parameters<React.ComponentProps<typeof Projects>['children']>[0]['projects'];
  projectsLoaded: boolean;
  orgId: string;
  filteredStatus: 'open' | 'closed';
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
    const {rule, filteredStatus} = this.props;
    // const {error, stats} = this.state;
    const created = moment(rule.dateCreated).format();
    // const slug = incident.projects[0];

    return (
      <ErrorBoundary>
        <IncidentPanelItem>
          <TableLayout status={filteredStatus}>
            <div>Metric</div>
            <Title>{rule.name}</Title>
            <div>All</div>

            {/* <ProjectBadge
              avatarSize={18}
              project={!projectsLoaded ? {slug} : this.getProject(slug, projects)}
            /> */}

            <DateTime date={created} />
          </TableLayout>
        </IncidentPanelItem>
      </ErrorBoundary>
    );
  }
}

function ErrorLoadingStatsIcon() {
  return (
    <Tooltip title={t('Error loading alert stats')}>
      <IconWarning />
    </Tooltip>
  );
}

const CreatedResolvedTime = styled('div')`
  ${overflowEllipsis}
  line-height: 1.4;
  display: flex;
  align-items: center;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

const StatusIndicator = styled('div')<{color: string}>`
  width: 10px;
  height: 12px;
  background: ${p => p.color};
  display: inline-block;
  border-top-right-radius: 40%;
  border-bottom-right-radius: 40%;
  margin-bottom: -1px;
`;

const Title = styled('span')`
  ${overflowEllipsis}
`;

const IncidentLink = styled(Link)`
  padding: 0 ${space(1)};
`;

const IncidentPanelItem = styled(PanelItem)`
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1.5)} ${space(2)} ${space(1.5)} 0;
`;

export default RuleListRow;
