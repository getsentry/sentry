import {Fragment, PureComponent} from 'react';
import styled from '@emotion/styled';

import AlertBadge from 'sentry/components/alertBadge';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {SectionHeading} from 'sentry/components/charts/styles';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import {PanelBody} from 'sentry/components/panels';
import TimeSince from 'sentry/components/timeSince';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Actor} from 'sentry/types';
import {IssueAlertRule} from 'sentry/types/alerts';

type Props = {
  rule: IssueAlertRule;
};

class Sidebar extends PureComponent<Props> {
  renderConditions() {
    const {rule} = this.props;
    const conditions = rule.conditions.length
      ? rule.conditions.map(condition => (
          <ConditionsBadge key={condition.id}>{condition.name}</ConditionsBadge>
        ))
      : '';
    const filters = rule.filters.length
      ? rule.filters.map(filter => (
          <ConditionsBadge key={filter.id}>
            {filter.time ? filter.name + '(s)' : filter.name}
          </ConditionsBadge>
        ))
      : '';
    const actions = rule.actions.length
      ? rule.actions.map(action => (
          <ConditionsBadge key={action.id}>{action.name}</ConditionsBadge>
        ))
      : '';

    return (
      <PanelBody>
        <Step>
          <StepContainer>
            <ChevronContainer>
              <IconChevron color="gray200" isCircled direction="right" size="sm" />
            </ChevronContainer>
            <StepContent>
              <StepLead>
                {tct('[when:When] [selector] of the following happens', {
                  when: <Badge />,
                  selector: rule.actionMatch,
                })}
              </StepLead>
              <ConditionsBadge>{t('An event is captured')}</ConditionsBadge>
              {conditions}
            </StepContent>
          </StepContainer>
        </Step>
        {filters && (
          <Step>
            <StepContainer>
              <ChevronContainer>
                <IconChevron color="gray200" isCircled direction="right" size="sm" />
              </ChevronContainer>
              <StepContent>
                <StepLead>
                  {tct('[if:If] [selector] of these filters match', {
                    if: <Badge />,
                    selector: rule.filterMatch,
                  })}
                </StepLead>
                {filters}
              </StepContent>
            </StepContainer>
          </Step>
        )}
        <Step>
          <StepContainer>
            <ChevronContainer>
              <IconChevron isCircled color="gray200" direction="right" size="sm" />
            </ChevronContainer>
            <div>
              <StepLead>
                {tct('[then:Then] perform these actions', {
                  then: <Badge />,
                })}
              </StepLead>
              {actions}
            </div>
          </StepContainer>
        </Step>
      </PanelBody>
    );
  }

  render() {
    const {rule} = this.props;
    const dateTriggered = new Date(0);
    const dateModified = new Date(0);

    const ownerId = rule.owner?.split(':')[1];
    const teamActor = ownerId && {type: 'team' as Actor['type'], id: ownerId, name: ''};

    return (
      <Fragment>
        <StatusContainer>
          <HeaderItem>
            <Heading noMargin>{t('Alert Status')}</Heading>
            <Status>
              <AlertBadge status={undefined} />
            </Status>
          </HeaderItem>
          <HeaderItem>
            <Heading noMargin>{t('Last Triggered')}</Heading>
            <Status>
              {dateTriggered ? (
                <TimeSince date={dateTriggered} />
              ) : (
                t('No alerts triggered')
              )}
            </Status>
          </HeaderItem>
        </StatusContainer>
        <ConditionsSidebarGroup>
          <Heading>{t('Alert Conditions')}</Heading>
          {this.renderConditions()}
        </ConditionsSidebarGroup>
        <SidebarGroup>
          <Heading>{t('Alert Rule Details')}</Heading>
          <KeyValueTable>
            {rule.dateCreated && (
              <KeyValueTableRow
                keyName={t('Alert Rule Created')}
                value={<TimeSince date={rule.dateCreated} suffix={t('ago')} />}
              />
            )}
            {rule.createdBy && (
              <KeyValueTableRow
                keyName={t('Created By')}
                value={<CreatedBy>{rule.createdBy.name ?? '-'}</CreatedBy>}
              />
            )}
            {dateModified && (
              <KeyValueTableRow
                keyName={t('Last Modified')}
                value={<TimeSince date={dateModified} suffix={t('ago')} />}
              />
            )}
            <KeyValueTableRow
              keyName={t('Team')}
              value={
                teamActor ? <ActorAvatar actor={teamActor} size={24} /> : 'Unassigned'
              }
            />
          </KeyValueTable>
        </SidebarGroup>
      </Fragment>
    );
  }
}

export default Sidebar;

const SidebarGroup = styled('div')`
  margin-bottom: ${space(3)};
`;

const ConditionsSidebarGroup = styled(SidebarGroup)`
  display: inline-block;
`;

const HeaderItem = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;

  > *:nth-child(2) {
    flex: 1;
    display: flex;
    align-items: center;
  }
`;

const Status = styled('div')`
  position: relative;
  display: grid;
  grid-template-columns: auto auto auto;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeLarge};
`;

const StatusContainer = styled('div')`
  height: 60px;
  display: flex;
  margin-bottom: ${space(1.5)};
`;

const Step = styled('div')`
  position: relative;
  margin-top: ${space(4)};

  :first-child {
    margin-top: ${space(3)};
  }
`;

const StepContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  flex-grow: 1;
`;

const StepContent = styled('div')`
  &::before {
    content: '';
    position: absolute;
    height: 100%;
    top: 28px;
    left: ${space(1)};
    border-right: 1px ${p => p.theme.gray200} dashed;
  }
`;

const StepLead = styled('div')`
  margin-bottom: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 400;
`;

const ChevronContainer = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(0.5)} ${space(1)} ${space(0.5)} 0;
`;

const Badge = styled('span')`
  display: inline-block;
  background-color: ${p => p.theme.purple300};
  padding: 0 ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.white};
  text-transform: uppercase;
  text-align: center;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 400;
  line-height: 1.5;
`;

const ConditionsBadge = styled('span')`
  display: block;
  background-color: ${p => p.theme.surface100};
  padding: 0 ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: ${space(1)};
  width: fit-content;
  font-weight: 400;
`;

const Heading = styled(SectionHeading)<{noMargin?: boolean}>`
  display: grid;
  grid-template-columns: auto auto;
  justify-content: flex-start;
  margin-top: ${p => (p.noMargin ? 0 : space(2))};
  margin-bottom: ${space(0.5)};
  line-height: 1;
  gap: ${space(1)};
`;

const CreatedBy = styled('div')`
  ${overflowEllipsis}
`;
