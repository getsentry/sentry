import React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import memoize from 'lodash/memoize';

import Access from 'app/components/acl/access';
import MenuItemActionLink from 'app/components/actions/menuItemActionLink';
import ActorAvatar from 'app/components/avatar/actorAvatar';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import DateTime from 'app/components/dateTime';
import DropdownLink from 'app/components/dropdownLink';
import ErrorBoundary from 'app/components/errorBoundary';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import {IconArrow, IconDelete, IconEllipsis, IconSettings} from 'app/icons';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Actor, Organization, Project} from 'app/types';
import getDynamicText from 'app/utils/getDynamicText';
import {Color} from 'app/utils/theme';
import {AlertRuleThresholdType} from 'app/views/settings/incidentRules/types';

import AlertBadge from '../alertBadge';
import {CombinedMetricIssueAlerts, IncidentStatus} from '../types';
import {isIssueAlert} from '../utils';

type Props = {
  rule: CombinedMetricIssueAlerts;
  projects: Project[];
  projectsLoaded: boolean;
  orgId: string;
  organization: Organization;
  onDelete: (projectId: string, rule: CombinedMetricIssueAlerts) => void;
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

  activeIncident() {
    const {rule} = this.props;
    return (
      rule.latestIncident?.status !== undefined &&
      [IncidentStatus.CRITICAL, IncidentStatus.WARNING].includes(
        rule.latestIncident.status
      )
    );
  }

  renderLastIncidentDate(): React.ReactNode {
    const {rule} = this.props;
    if (isIssueAlert(rule)) {
      return null;
    }

    if (!rule.latestIncident) {
      return '-';
    }

    if (this.activeIncident()) {
      return (
        <div>
          {t('Triggered ')}
          <TimeSince date={rule.latestIncident.dateCreated} />
        </div>
      );
    }

    return (
      <div>
        {t('Resolved ')}
        <TimeSince date={rule.latestIncident.dateClosed!} />
      </div>
    );
  }

  renderAlertRuleStatus(): React.ReactNode {
    const {rule} = this.props;

    if (isIssueAlert(rule)) {
      return null;
    }

    const activeIncident = this.activeIncident();
    const criticalTrigger = rule?.triggers.find(({label}) => label === 'critical');
    const warningTrigger = rule?.triggers.find(({label}) => label === 'warning');
    const trigger =
      activeIncident && rule.latestIncident?.status === IncidentStatus.CRITICAL
        ? criticalTrigger
        : warningTrigger ?? criticalTrigger;

    let iconColor: Color = 'green300';
    if (activeIncident) {
      iconColor =
        trigger?.label === 'critical'
          ? 'red300'
          : trigger?.label === 'warning'
          ? 'yellow300'
          : 'green300';
    }

    const thresholdTypeText =
      activeIncident && rule.thresholdType === AlertRuleThresholdType.ABOVE
        ? t('Above')
        : t('Below');

    return (
      <FlexCenter>
        <IconArrow
          color={iconColor}
          direction={
            activeIncident && rule.thresholdType === AlertRuleThresholdType.ABOVE
              ? 'up'
              : 'down'
          }
        />
        <TriggerText>{`${thresholdTypeText} ${trigger?.alertThreshold?.toLocaleString()}`}</TriggerText>
      </FlexCenter>
    );
  }

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
    const hasAlertOwnership = organization.features.includes('team-alerts-ownership');
    const hasAlertList = organization.features.includes('alert-details-redesign');
    const alertLink = (
      <TitleLink to={hasRedesign ? detailsLink : editLink}>{rule.name}</TitleLink>
    );

    const IssueStatusText: Record<IncidentStatus, string> = {
      [IncidentStatus.CRITICAL]: t('Critical'),
      [IncidentStatus.WARNING]: t('Warning'),
      [IncidentStatus.CLOSED]: t('Resolved'),
      [IncidentStatus.OPENED]: t('Resolved'),
    };

    return (
      <ErrorBoundary>
        {!hasAlertList ? (
          <React.Fragment>
            <RuleType>{isIssueAlert(rule) ? t('Issue') : t('Metric')}</RuleType>
            <Title>{alertLink}</Title>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <AlertNameWrapper isIncident={isIssueAlert(rule)}>
              <FlexCenter>
                <Tooltip
                  title={
                    isIssueAlert(rule)
                      ? t('Issue Alert')
                      : IssueStatusText[
                          rule?.latestIncident?.status ?? IncidentStatus.CLOSED
                        ]
                  }
                >
                  <AlertBadge
                    status={rule?.latestIncident?.status}
                    isIssue={isIssueAlert(rule)}
                    hideText
                  />
                </Tooltip>
              </FlexCenter>
              <AlertNameAndStatus>
                <AlertName>{alertLink}</AlertName>
                {!isIssueAlert(rule) && this.renderLastIncidentDate()}
              </AlertNameAndStatus>
            </AlertNameWrapper>
            <FlexCenter>{this.renderAlertRuleStatus()}</FlexCenter>
          </React.Fragment>
        )}

        <FlexCenter>
          <ProjectBadgeContainer>
            <ProjectBadge
              avatarSize={18}
              project={!projectsLoaded ? {slug} : this.getProject(slug, projects)}
            />
          </ProjectBadgeContainer>
        </FlexCenter>
        {hasAlertOwnership && (
          <FlexCenter>
            {teamActor ? <ActorAvatar actor={teamActor} size={24} /> : '-'}
          </FlexCenter>
        )}
        {!hasAlertList && <CreatedBy>{rule?.createdBy?.name ?? '-'}</CreatedBy>}
        <FlexCenter>
          <DateTime
            date={getDynamicText({
              value: rule.dateCreated,
              fixed: new Date('2021-04-20'),
            })}
            format="ll"
          />
        </FlexCenter>
        <ActionsRow>
          <Access access={['alerts:write']}>
            {({hasAccess}) => (
              <React.Fragment>
                <StyledDropdownLink>
                  <DropdownLink
                    anchorRight
                    caret={false}
                    title={
                      <Button
                        tooltipProps={{
                          containerDisplayMode: 'flex',
                        }}
                        size="small"
                        type="button"
                        aria-label={t('Show more')}
                        icon={<IconEllipsis size="xs" />}
                      />
                    }
                  >
                    <li>
                      <Link to={editLink}>{t('Edit')}</Link>
                    </li>
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
                      <MenuItemActionLink title={t('Delete')}>
                        {t('Delete')}
                      </MenuItemActionLink>
                    </Confirm>
                  </DropdownLink>
                </StyledDropdownLink>

                {/* Small screen actions */}
                <StyledButtonBar gap={1}>
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
                  <Tooltip title={t('Edit')}>
                    <Button
                      size="small"
                      type="button"
                      icon={<IconSettings />}
                      to={editLink}
                    />
                  </Tooltip>
                </StyledButtonBar>
              </React.Fragment>
            )}
          </Access>
        </ActionsRow>
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

const RuleType = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 400;
  color: ${p => p.theme.gray300};
  text-transform: uppercase;
  ${columnCss}
`;

const Title = styled('div')`
  ${columnCss}
`;

const TitleLink = styled(Link)`
  ${overflowEllipsis}

  @media (max-width: ${p => p.theme.breakpoints[3]}) {
    max-width: 300px;
  }
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    max-width: 165px;
  }
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    max-width: 100px;
  }
`;

const CreatedBy = styled('div')`
  ${overflowEllipsis}
  ${columnCss}
`;

const FlexCenter = styled('div')`
  display: flex;
  align-items: center;
`;

const AlertNameWrapper = styled(FlexCenter)<{isIncident?: boolean}>`
  ${p => p.isIncident && `padding: ${space(3)} ${space(2)}; line-height: 2.4;`}
`;

const AlertNameAndStatus = styled('div')`
  ${overflowEllipsis}
  margin-left: ${space(1.5)};
  line-height: 1.35;
`;

const AlertName = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const ProjectBadgeContainer = styled('div')`
  width: 100%;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

const TriggerText = styled('div')`
  margin-left: ${space(1)};
  white-space: nowrap;
`;

const StyledButtonBar = styled(ButtonBar)`
  display: none;
  justify-content: flex-start;
  align-items: center;

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    display: flex;
  }
`;

const StyledDropdownLink = styled('div')`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: block;
  }
`;

const ActionsRow = styled(FlexCenter)`
  justify-content: center;
  padding: ${space(1)};
`;

export default RuleListRow;
