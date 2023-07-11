import {Fragment} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {SectionHeading} from 'sentry/components/charts/styles';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import PanelBody from 'sentry/components/panels/panelBody';
import TimeSince from 'sentry/components/timeSince';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Actor, Member, Team} from 'sentry/types';
import {IssueAlertRule} from 'sentry/types/alerts';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {TextAction, TextCondition} from './textRule';

type Props = {
  projectSlug: string;
  rule: IssueAlertRule;
  teams: Team[];
};

function Conditions({rule, teams, projectSlug}: Props) {
  const organization = useOrganization();
  const {data: memberList} = useApiQuery<Member[]>(
    [`/organizations/${organization.slug}/users/`, {query: {projectSlug}}],
    {staleTime: 60000}
  );

  return (
    <PanelBody>
      <Step>
        <StepContainer>
          <ChevronContainer>
            <IconChevron color="gray200" isCircled direction="right" size="sm" />
          </ChevronContainer>
          <StepContent>
            <StepLead>
              {tct('[when:When] an event is captured [selector]', {
                when: <Badge />,
                selector: rule.conditions.length ? t('and %s...', rule.actionMatch) : '',
              })}
            </StepLead>
            {rule.conditions.map((condition, idx) => (
              <ConditionsBadge key={idx}>
                <TextCondition condition={condition} />
              </ConditionsBadge>
            ))}
          </StepContent>
        </StepContainer>
      </Step>
      {rule.filters.length ? (
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
              {rule.filters.map((filter, idx) => (
                <ConditionsBadge key={idx}>
                  {filter.time ? filter.name + '(s)' : filter.name}
                </ConditionsBadge>
              ))}
            </StepContent>
          </StepContainer>
        </Step>
      ) : null}
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
            {rule.actions.length ? (
              rule.actions.map((action, idx) => {
                return (
                  <ConditionsBadge key={idx}>
                    <TextAction
                      action={action}
                      memberList={memberList ?? []}
                      teams={teams}
                    />
                  </ConditionsBadge>
                );
              })
            ) : (
              <ConditionsBadge>{t('Do nothing')}</ConditionsBadge>
            )}
          </div>
        </StepContainer>
      </Step>
    </PanelBody>
  );
}

function Sidebar({rule, teams, projectSlug}: Props) {
  const ownerId = rule.owner?.split(':')[1];
  const teamActor = ownerId && {type: 'team' as Actor['type'], id: ownerId, name: ''};

  return (
    <Fragment>
      <StatusContainer>
        <HeaderItem>
          <Heading noMargin>{t('Last Triggered')}</Heading>
          <Status>
            {rule.lastTriggered ? (
              <TimeSince date={rule.lastTriggered} />
            ) : (
              t('No alerts triggered')
            )}
          </Status>
        </HeaderItem>
      </StatusContainer>
      <SidebarGroup>
        <Heading noMargin>{t('Alert Conditions')}</Heading>
        <Conditions rule={rule} teams={teams} projectSlug={projectSlug} />
      </SidebarGroup>
      <SidebarGroup>
        <Heading>{t('Alert Rule Details')}</Heading>
        <KeyValueTable>
          <KeyValueTableRow
            keyName={t('Environment')}
            value={<OverflowTableValue>{rule.environment ?? '-'}</OverflowTableValue>}
          />
          {rule.dateCreated && (
            <KeyValueTableRow
              keyName={t('Date Created')}
              value={<TimeSince date={rule.dateCreated} suffix={t('ago')} />}
            />
          )}
          {rule.createdBy && (
            <KeyValueTableRow
              keyName={t('Created By')}
              value={
                <OverflowTableValue>{rule.createdBy.name ?? '-'}</OverflowTableValue>
              }
            />
          )}
          <KeyValueTableRow
            keyName={t('Team')}
            value={
              teamActor ? <ActorAvatar actor={teamActor} size={24} /> : t('Unassigned')
            }
          />
        </KeyValueTable>
      </SidebarGroup>
    </Fragment>
  );
}

export default Sidebar;

const SidebarGroup = styled('div')`
  margin-bottom: ${space(3)};
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
    margin-top: ${space(1)};
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
  background-color: ${p => p.theme.surface200};
  padding: 0 ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: ${space(1)};
  width: fit-content;
  font-weight: 400;
`;

const Heading = styled(SectionHeading)<{noMargin?: boolean}>`
  margin-top: ${p => (p.noMargin ? 0 : space(2))};
  margin-bottom: ${p => (p.noMargin ? 0 : space(1))};
`;

const OverflowTableValue = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;
