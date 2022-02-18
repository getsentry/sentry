import * as React from 'react';
import {Fragment, PureComponent} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {SectionHeading} from 'sentry/components/charts/styles';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Actor} from 'sentry/types';
import {IssueAlertRule} from 'sentry/types/alerts';
import AlertBadge from 'sentry/views/alerts/alertBadge';

type Props = {
  rule: IssueAlertRule;
};

class Sidebar extends PureComponent<Props> {
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
        <SidebarGroup>
          <Heading>{t('Alert Conditions')}</Heading>
          <p>When if then</p>
        </SidebarGroup>
        <SidebarGroup>
          <Heading>{t('Alert Rule Details')}</Heading>
          <KeyValueTable>
            <KeyValueTableRow
              keyName={t('Alert Rule Created')}
              value={<TimeSince date={rule.dateCreated} suffix={t('ago')} />}
            />
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
