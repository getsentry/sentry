import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import color from 'color';
import sortBy from 'lodash/sortBy';
import startCase from 'lodash/startCase';

import {loadIncidents} from 'sentry/actionCreators/serviceIncidents';
import Button from 'sentry/components/button';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Text from 'sentry/components/text';
import Tooltip from 'sentry/components/tooltip';
import {IS_ACCEPTANCE_TEST} from 'sentry/constants';
import {
  IconCheckmark,
  IconFatal,
  IconFire,
  IconInfo,
  IconOpen,
  IconWarning,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SentryServiceStatus} from 'sentry/types';
import marked from 'sentry/utils/marked';

import TimeSince from '../timeSince';

import SidebarItem from './sidebarItem';
import SidebarPanel from './sidebarPanel';
import SidebarPanelEmpty from './sidebarPanelEmpty';
import SidebarPanelItem from './sidebarPanelItem';
import {CommonSidebarProps, SidebarPanelKey} from './types';

type Props = CommonSidebarProps;

type Status =
  SentryServiceStatus['incidents'][number]['affectedComponents'][number]['status'];

const COMPONENT_STATUS_SORT: Status[] = [
  'operational',
  'degraded_performance',
  'partial_outage',
  'major_outage',
];

function ServiceIncidents({
  currentPanel,
  onShowPanel,
  hidePanel,
  collapsed,
  orientation,
}: Props) {
  const [serviceStatus, setServiceStatus] = useState<SentryServiceStatus | null>(null);

  async function fetchData() {
    try {
      setServiceStatus(await loadIncidents());
    } catch (e) {
      Sentry.withScope(scope => {
        scope.setLevel('warning');
        scope.setFingerprint(['ServiceIncidents-fetchData']);
        Sentry.captureException(e);
      });
    }
  }

  useEffect(() => void fetchData(), []);

  // Never render incidents in acceptance tests
  if (IS_ACCEPTANCE_TEST) {
    return null;
  }

  if (!serviceStatus) {
    return null;
  }

  const active = currentPanel === SidebarPanelKey.ServiceIncidents;
  const isEmpty = !serviceStatus.incidents || serviceStatus.incidents.length === 0;

  if (isEmpty) {
    return null;
  }

  return (
    <Fragment>
      <SidebarItem
        id="statusupdate"
        orientation={orientation}
        collapsed={collapsed}
        active={active}
        icon={<IconWarning size="md" />}
        label={t('Service status')}
        onClick={onShowPanel}
      />
      {active && serviceStatus && (
        <SidebarPanel
          orientation={orientation}
          title={t('Recent service updates')}
          hidePanel={hidePanel}
          collapsed={collapsed}
        >
          {isEmpty && (
            <SidebarPanelEmpty>{t('There are no incidents to report')}</SidebarPanelEmpty>
          )}
          {serviceStatus.incidents.map(incident => (
            <SidebarPanelItem
              title={incident.name}
              key={incident.id}
              titleAction={
                <Button
                  size="xs"
                  icon={<IconOpen size="xs" />}
                  priority="link"
                  href={incident.url}
                  external
                >
                  {t('Full Incident Details')}
                </Button>
              }
            >
              <AffectedServices>
                {tct(
                  "This incident started [timeAgo]. We're experiencing the following problems with our services",
                  {
                    timeAgo: (
                      <strong>
                        <TimeSince date={incident.createdAt} />
                      </strong>
                    ),
                  }
                )}
                <ComponentList>
                  {sortBy(incident.affectedComponents, i =>
                    COMPONENT_STATUS_SORT.indexOf(i.status)
                  ).map(({name, status}, key) => (
                    <ComponentStatus
                      key={key}
                      padding="24px"
                      symbol={getStatusSymbol(status)}
                    >
                      {name}
                    </ComponentStatus>
                  ))}
                </ComponentList>
              </AffectedServices>

              <UpdatesList>
                {incident.updates.map(({status, body, updatedAt}, key) => (
                  <ListItem key={key}>
                    <UpdateHeading>
                      <StatusTitle>{startCase(status)}</StatusTitle>
                      <StatusDate>
                        {tct('([time])', {time: <TimeSince date={updatedAt} />})}
                      </StatusDate>
                    </UpdateHeading>
                    <Text dangerouslySetInnerHTML={{__html: marked(body)}} />
                  </ListItem>
                ))}
              </UpdatesList>
            </SidebarPanelItem>
          ))}
        </SidebarPanel>
      )}
    </Fragment>
  );
}

function getStatusSymbol(status: Status) {
  return (
    <Tooltip skipWrapper title={startCase(status)}>
      {status === 'operational' ? (
        <IconCheckmark size="sm" isCircled color="successText" />
      ) : status === 'major_outage' ? (
        <IconFatal size="sm" color="errorText" />
      ) : status === 'degraded_performance' ? (
        <IconWarning size="sm" color="warningText" />
      ) : status === 'partial_outage' ? (
        <IconFire size="sm" color="warningText" />
      ) : (
        <IconInfo size="sm" color="subText" />
      )}
    </Tooltip>
  );
}

const AffectedServices = styled('div')`
  margin: ${space(2)} 0;
`;

const UpdatesList = styled(List)`
  gap: ${space(3)};
  margin-left: ${space(1.5)};
  position: relative;

  &::before {
    content: '';
    display: block;
    position: absolute;
    height: 100%;
    width: 2px;
    margin: ${space(1)} 0 ${space(1)} -${space(1.5)};
    background: ${p => p.theme.gray100};
  }

  &::after {
    content: '';
    display: block;
    position: absolute;
    bottom: -${space(1)};
    margin-left: -${space(1.5)};
    height: 30px;
    width: 2px;
    background: linear-gradient(
      0deg,
      ${p => p.theme.background},
      ${p => color(p.theme.background).alpha(0).string()}
    );
  }
`;

const UpdateHeading = styled('div')`
  margin-bottom: ${space(0.5)};
  display: flex;
  align-items: center;
  gap: ${space(1)};
  position: relative;

  &::before {
    content: '';
    display: block;
    position: absolute;
    height: 8px;
    width: 8px;
    margin-left: -15px;
    border-radius: 50%;
    background: ${p => p.theme.purple300};
  }
`;

const StatusTitle = styled('div')`
  color: ${p => p.theme.headingColor};
  font-weight: bold;
`;

const StatusDate = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;

const ComponentList = styled(List)`
  margin-top: ${space(1)};
  display: block;
  column-count: 2;
`;

const ComponentStatus = styled(ListItem)`
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 2;
`;

export default ServiceIncidents;
