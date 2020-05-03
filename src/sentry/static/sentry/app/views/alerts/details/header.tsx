import {Params} from 'react-router/lib/Router';
import React from 'react';
import moment from 'moment';
import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import {PageHeader} from 'app/styles/organization';
import {t} from 'app/locale';
import Count from 'app/components/count';
import DropdownControl from 'app/components/dropdownControl';
import Duration from 'app/components/duration';
import LoadingError from 'app/components/loadingError';
import MenuItem from 'app/components/menuItem';
import PageHeading from 'app/components/pageHeading';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import Projects from 'app/utils/projects';
import SubscribeButton from 'app/components/subscribeButton';
import getDynamicText from 'app/utils/getDynamicText';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import {IconCheckmark} from 'app/icons';
import Breadcrumbs from 'app/components/breadcrumbs';

import {Incident, IncidentStats} from '../types';
import {isOpen} from '../utils';
import Status from '../status';

type Props = {
  className?: string;
  hasIncidentDetailsError: boolean;
  incident?: Incident;
  stats?: IncidentStats;
  onSubscriptionChange: (event: React.MouseEvent) => void;
  onStatusChange: (eventKey: any) => void;
  params: Params;
};

export default class DetailsHeader extends React.Component<Props> {
  renderStatus() {
    const {incident, onStatusChange} = this.props;

    const isIncidentOpen = incident && isOpen(incident);
    const statusLabel = incident ? <Status incident={incident} /> : null;

    return isIncidentOpen ? (
      <DropdownControl
        data-test-id="status-dropdown"
        label={statusLabel}
        menuWidth="200px"
        alignRight
        buttonProps={{size: 'small', disabled: !incident}}
      >
        <StatusMenuItem onSelect={onStatusChange}>
          <IconCheckmark isCircle color={theme.greenLight} />
          {t('Resolve this incident')}
        </StatusMenuItem>
      </DropdownControl>
    ) : (
      statusLabel
    );
  }

  render() {
    const {
      hasIncidentDetailsError,
      incident,
      params,
      stats,
      onSubscriptionChange,
    } = this.props;
    const isIncidentReady = !!incident && !hasIncidentDetailsError;
    const dateStarted = incident && moment(incident.dateStarted).format('LL');
    const duration =
      incident &&
      moment
        .duration(
          moment(incident.dateClosed || new Date()).diff(moment(incident.dateStarted))
        )
        .as('seconds');

    const project = incident && incident.projects && incident.projects[0];

    return (
      <Header>
        <PageHeading>
          <AlertBreadcrumbs
            crumbs={[
              {label: t('Alerts'), to: `/organizations/${params.orgId}/alerts/`},
              {label: dateStarted ?? t('Alert details')},
            ]}
          />
          <IncidentTitle data-test-id="incident-title" loading={!isIncidentReady}>
            {incident && !hasIncidentDetailsError ? incident.title : 'Loading'}
          </IncidentTitle>
        </PageHeading>

        {hasIncidentDetailsError ? (
          <StyledLoadingError />
        ) : (
          <GroupedHeaderItems>
            <ItemTitle>{t('Status')}</ItemTitle>
            <ItemTitle>{t('Project')}</ItemTitle>
            <ItemTitle>{t('Users affected')}</ItemTitle>
            <ItemTitle>{t('Total events')}</ItemTitle>
            <ItemTitle>{t('Duration')}</ItemTitle>
            <ItemTitle>{t('Notifications')}</ItemTitle>
            <ItemValue>{this.renderStatus()}</ItemValue>
            <ItemValue>
              {project && (
                <Projects slugs={[project]} orgId={params.orgId}>
                  {({projects}) => (
                    <ProjectBadge
                      avatarSize={18}
                      project={projects && projects.length && projects[0]}
                    />
                  )}
                </Projects>
              )}
            </ItemValue>
            {stats && (
              <ItemValue>
                <Count value={stats.uniqueUsers} />
              </ItemValue>
            )}
            {stats && (
              <ItemValue>
                <Count value={stats.totalEvents} />
              </ItemValue>
            )}
            {incident && (
              <ItemValue>
                <Duration seconds={getDynamicText({value: duration || 0, fixed: 1200})} />
              </ItemValue>
            )}
            <ItemValue>
              <SubscribeButton
                disabled={!isIncidentReady}
                isSubscribed={incident && !!incident.isSubscribed}
                onClick={onSubscriptionChange}
                size="small"
              />
            </ItemValue>
          </GroupedHeaderItems>
        )}
      </Header>
    );
  }
}

const Header = styled(PageHeader)`
  background-color: ${p => p.theme.white};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  margin-bottom: 0;
  padding: ${space(3)};

  grid-template-columns: max-content auto;
  display: grid;
  grid-gap: ${space(3)};
  grid-auto-flow: column;

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: auto;
    grid-auto-flow: row;
  }
`;

const StyledLoadingError = styled(LoadingError)`
  flex: 1;

  &.alert.alert-block {
    margin: 0 20px;
  }
`;

const GroupedHeaderItems = styled('div')`
  display: grid;
  grid-template-columns: repeat(6, max-content);
  grid-gap: ${space(1)} ${space(4)};
  text-align: right;

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    text-align: left;
  }
`;

const ItemTitle = styled('h6')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: 0;
  text-transform: uppercase;
  color: ${p => p.theme.gray2};
  letter-spacing: 0.1px;
`;

const ItemValue = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const AlertBreadcrumbs = styled(Breadcrumbs)`
  font-size: ${p => p.theme.fontSizeLarge};
  padding: 0;
  margin-bottom: ${space(1)};
`;

const IncidentTitle = styled('div', {
  shouldForwardProp: p => isPropValid(p) && p !== 'loading',
})<{loading: boolean}>`
  ${p => p.loading && 'opacity: 0'};
`;

const StatusMenuItem = styled(MenuItem)`
  > span {
    font-size: ${p => p.theme.fontSizeMedium};
    text-align: left;
    display: grid;
    grid-template-columns: max-content 1fr;
    grid-gap: ${space(1)};
    align-items: center;
  }
`;
