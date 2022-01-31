import * as React from 'react';
import styled from '@emotion/styled';
import memoize from 'lodash/memoize';

import Access from 'sentry/components/acl/access';
import MenuItemActionLink from 'sentry/components/actions/menuItemActionLink';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import DateTime from 'sentry/components/dateTime';
import DropdownLink from 'sentry/components/dropdownLink';
import ErrorBoundary from 'sentry/components/errorBoundary';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import TimeSince from 'sentry/components/timeSince';
import Tooltip from 'sentry/components/tooltip';
import {IconArrow, IconDelete, IconEllipsis, IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Actor, Organization, Project} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import type {Color} from 'sentry/utils/theme';
import {AlertRuleThresholdType} from 'sentry/views/alerts/incidentRules/types';

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

/**
 * Memoized function to find a project from a list of projects
 */
const getProject = memoize((slug: string, projects: Project[]) =>
  projects.find(project => project.slug === slug)
);

function RuleListRow({
  rule,
  projectsLoaded,
  projects,
  orgId,
  onDelete,
  userTeams,
}: Props) {
  const activeIncident =
    rule.latestIncident?.status !== undefined &&
    [IncidentStatus.CRITICAL, IncidentStatus.WARNING].includes(
      rule.latestIncident.status
    );

  function renderLastIncidentDate(): React.ReactNode {
    if (isIssueAlert(rule)) {
      return null;
    }

    if (!rule.latestIncident) {
      return '-';
    }

    if (activeIncident) {
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

  function renderAlertRuleStatus(): React.ReactNode {
    if (isIssueAlert(rule)) {
      return null;
    }

    const criticalTrigger = rule.triggers.find(({label}) => label === 'critical');
    const warningTrigger = rule.triggers.find(({label}) => label === 'warning');
    const resolvedTrigger = rule.resolveThreshold;
    const trigger =
      activeIncident && rule.latestIncident?.status === IncidentStatus.CRITICAL
        ? criticalTrigger
        : warningTrigger ?? criticalTrigger;

    let iconColor: Color = 'green300';
    let iconDirection: 'up' | 'down' | undefined;
    let thresholdTypeText =
      activeIncident && rule.thresholdType === AlertRuleThresholdType.ABOVE
        ? t('Above')
        : t('Below');

    if (activeIncident) {
      iconColor =
        trigger?.label === 'critical'
          ? 'red300'
          : trigger?.label === 'warning'
          ? 'yellow300'
          : 'green300';
      iconDirection = rule.thresholdType === AlertRuleThresholdType.ABOVE ? 'up' : 'down';
    } else {
      // Use the Resolved threshold type, which is opposite of Critical
      iconDirection = rule.thresholdType === AlertRuleThresholdType.ABOVE ? 'down' : 'up';
      thresholdTypeText =
        rule.thresholdType === AlertRuleThresholdType.ABOVE ? t('Below') : t('Above');
    }

    return (
      <FlexCenter>
        <IconArrow color={iconColor} direction={iconDirection} />
        <TriggerText>
          {`${thresholdTypeText} ${
            rule.latestIncident || (!rule.latestIncident && !resolvedTrigger)
              ? trigger?.alertThreshold?.toLocaleString()
              : resolvedTrigger?.toLocaleString()
          }`}
        </TriggerText>
      </FlexCenter>
    );
  }

  const slug = rule.projects[0];
  const editLink = `/organizations/${orgId}/alerts/${
    isIssueAlert(rule) ? 'rules' : 'metric-rules'
  }/${slug}/${rule.id}/`;

  const detailsLink = `/organizations/${orgId}/alerts/rules/details/${rule.id}/`;

  const ownerId = rule.owner?.split(':')[1];
  const teamActor = ownerId
    ? {type: 'team' as Actor['type'], id: ownerId, name: ''}
    : null;

  const canEdit = ownerId ? userTeams.has(ownerId) : true;
  const alertLink = isIssueAlert(rule) ? (
    rule.name
  ) : (
    <TitleLink to={isIssueAlert(rule) ? editLink : detailsLink}>{rule.name}</TitleLink>
  );

  const IssueStatusText: Record<IncidentStatus, string> = {
    [IncidentStatus.CRITICAL]: t('Critical'),
    [IncidentStatus.WARNING]: t('Warning'),
    [IncidentStatus.CLOSED]: t('Resolved'),
    [IncidentStatus.OPENED]: t('Resolved'),
  };

  return (
    <ErrorBoundary>
      <AlertNameWrapper isIssueAlert={isIssueAlert(rule)}>
        <FlexCenter>
          <Tooltip
            title={
              isIssueAlert(rule)
                ? t('Issue Alert')
                : tct('Metric Alert Status: [status]', {
                    status:
                      IssueStatusText[
                        rule?.latestIncident?.status ?? IncidentStatus.CLOSED
                      ],
                  })
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
          <AlertIncidentDate>
            {!isIssueAlert(rule) && renderLastIncidentDate()}
          </AlertIncidentDate>
        </AlertNameAndStatus>
      </AlertNameWrapper>
      <FlexCenter>{renderAlertRuleStatus()}</FlexCenter>

      <FlexCenter>
        <ProjectBadgeContainer>
          <ProjectBadge
            avatarSize={18}
            project={!projectsLoaded ? {slug} : getProject(slug, projects)}
          />
        </ProjectBadgeContainer>
      </FlexCenter>

      <FlexCenter>
        {teamActor ? <ActorAvatar actor={teamActor} size={24} /> : '-'}
      </FlexCenter>

      <FlexCenter>
        <StyledDateTime
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
                    aria-label={t('Delete')}
                  />
                </Confirm>
                <Button
                  size="small"
                  type="button"
                  icon={<IconSettings />}
                  to={editLink}
                  title={t('Edit')}
                  aria-label={t('Edit')}
                />
              </StyledButtonBar>
            </React.Fragment>
          )}
        </Access>
      </ActionsRow>
    </ErrorBoundary>
  );
}

const TitleLink = styled(Link)`
  ${overflowEllipsis}
`;

const FlexCenter = styled('div')`
  display: flex;
  align-items: center;
`;

const AlertNameWrapper = styled(FlexCenter)<{isIssueAlert?: boolean}>`
  ${p => p.isIssueAlert && `padding: ${space(3)} ${space(2)}; line-height: 2.4;`}
`;

const AlertNameAndStatus = styled('div')`
  ${overflowEllipsis}
  margin-left: ${space(1.5)};
  line-height: 1.35;
`;

const AlertName = styled('div')`
  ${overflowEllipsis}
  font-size: ${p => p.theme.fontSizeLarge};

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

const AlertIncidentDate = styled('div')`
  color: ${p => p.theme.gray300};
`;

const ProjectBadgeContainer = styled('div')`
  width: 100%;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

const StyledDateTime = styled(DateTime)`
  font-variant-numeric: tabular-nums;
  color: ${p => p.theme.gray300};
`;

const TriggerText = styled('div')`
  margin-left: ${space(1)};
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
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
