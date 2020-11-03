import {Params} from 'react-router/lib/Router';
import React from 'react';
import moment from 'moment';
import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import {PageHeader} from 'app/styles/organization';
import {t} from 'app/locale';
import Count from 'app/components/count';
import Duration from 'app/components/duration';
import LoadingError from 'app/components/loadingError';
import MenuItem from 'app/components/menuItem';
import PageHeading from 'app/components/pageHeading';
import Placeholder from 'app/components/placeholder';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import Projects from 'app/utils/projects';
import SubscribeButton from 'app/components/subscribeButton';
import getDynamicText from 'app/utils/getDynamicText';
import space from 'app/styles/space';
import {IconCheckmark} from 'app/icons';
import Breadcrumbs from 'app/components/breadcrumbs';
import {Dataset} from 'app/views/settings/incidentRules/types';
import DropdownControl from 'app/components/dropdownControl';
import {use24Hours} from 'app/utils/dates';

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
    const statusLabel = incident ? <StyledStatus incident={incident} /> : null;

    return (
      <DropdownControl
        data-test-id="status-dropdown"
        label={statusLabel}
        alignRight
        blendWithActor={false}
        buttonProps={{
          size: 'small',
          disabled: !incident || !isIncidentOpen,
          hideBottomBorder: false,
        }}
      >
        <StatusMenuItem isActive>
          {incident && <Status disableIconColor incident={incident} />}
        </StatusMenuItem>
        <StatusMenuItem onSelect={onStatusChange}>
          <IconCheckmark color="green400" />
          {t('Resolved')}
        </StatusMenuItem>
      </DropdownControl>
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
    // ex - Wed, May 27, 2020 11:09 AM
    const dateFormat = use24Hours() ? 'ddd, MMM D, YYYY HH:mm' : 'llll';
    const dateStarted =
      incident && moment(new Date(incident.dateStarted)).format(dateFormat);
    const duration =
      incident &&
      moment(incident.dateClosed ? new Date(incident.dateClosed) : new Date()).diff(
        moment(new Date(incident.dateStarted)),
        'seconds'
      );
    const isErrorDataset = incident?.alertRule?.dataset === Dataset.ERRORS;
    const environmentLabel = incident?.alertRule?.environment ?? t('All Environments');

    const project = incident && incident.projects && incident.projects[0];

    return (
      <Header>
        <BreadCrumbBar>
          <AlertBreadcrumbs
            crumbs={[
              {label: t('Alerts'), to: `/organizations/${params.orgId}/alerts/`},
              {label: incident && `#${incident.id}`},
            ]}
          />
          <Controls>
            <SubscribeButton
              disabled={!isIncidentReady}
              isSubscribed={incident?.isSubscribed}
              onClick={onSubscriptionChange}
              size="small"
            />
            {this.renderStatus()}
          </Controls>
        </BreadCrumbBar>
        <Details columns={isErrorDataset ? 5 : 3}>
          <div>
            <IncidentTitle data-test-id="incident-title" loading={!isIncidentReady}>
              {incident && !hasIncidentDetailsError ? incident.title : 'Loading'}
            </IncidentTitle>
            <IncidentSubTitle loading={!isIncidentReady}>
              {t('Triggered: ')}
              {dateStarted}
            </IncidentSubTitle>
          </div>

          {hasIncidentDetailsError ? (
            <StyledLoadingError />
          ) : (
            <GroupedHeaderItems columns={isErrorDataset ? 5 : 3}>
              <ItemTitle>{t('Environment')}</ItemTitle>
              <ItemTitle>{t('Project')}</ItemTitle>
              {isErrorDataset && <ItemTitle>{t('Users affected')}</ItemTitle>}
              {isErrorDataset && <ItemTitle>{t('Total events')}</ItemTitle>}
              <ItemTitle>{t('Active For')}</ItemTitle>
              <ItemValue>{environmentLabel}</ItemValue>
              <ItemValue>
                {project ? (
                  <Projects slugs={[project]} orgId={params.orgId}>
                    {({projects}) =>
                      projects?.length && (
                        <ProjectBadge avatarSize={18} project={projects[0]} />
                      )
                    }
                  </Projects>
                ) : (
                  <Placeholder height="25px" />
                )}
              </ItemValue>
              {isErrorDataset && (
                <ItemValue>
                  {stats ? (
                    <Count value={stats.uniqueUsers} />
                  ) : (
                    <Placeholder height="25px" />
                  )}
                </ItemValue>
              )}
              {isErrorDataset && (
                <ItemValue>
                  {stats ? (
                    <Count value={stats.totalEvents} />
                  ) : (
                    <Placeholder height="25px" />
                  )}
                </ItemValue>
              )}
              <ItemValue>
                {incident ? (
                  <Duration
                    seconds={getDynamicText({value: duration || 0, fixed: 1200})}
                  />
                ) : (
                  <Placeholder height="25px" />
                )}
              </ItemValue>
            </GroupedHeaderItems>
          )}
        </Details>
      </Header>
    );
  }
}

const Header = styled('div')`
  background-color: ${p => p.theme.gray100};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const BreadCrumbBar = styled('div')`
  display: flex;
  margin-bottom: 0;
  padding: ${space(2)} ${space(4)} ${space(1)};
`;

const AlertBreadcrumbs = styled(Breadcrumbs)`
  flex-grow: 1;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  padding: 0;
`;

const Controls = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
`;

const Details = styled(PageHeader, {
  shouldForwardProp: p => isPropValid(p) && p !== 'columns',
})<{columns: 3 | 5}>`
  margin-bottom: 0;
  padding: ${space(1.5)} ${space(4)} ${space(2)};

  grid-template-columns: max-content auto;
  display: grid;
  grid-gap: ${space(3)};
  grid-auto-flow: column;

  @media (max-width: ${p => p.theme.breakpoints[p.columns === 3 ? 1 : 2]}) {
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

const GroupedHeaderItems = styled('div', {
  shouldForwardProp: p => isPropValid(p) && p !== 'columns',
})<{columns: 3 | 5}>`
  display: grid;
  grid-template-columns: repeat(${p => p.columns}, max-content);
  grid-gap: ${space(1)} ${space(4)};
  text-align: right;
  margin-top: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints[p.columns === 3 ? 1 : 2]}) {
    text-align: left;
  }
`;

const ItemTitle = styled('h6')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: 0;
  text-transform: uppercase;
  color: ${p => p.theme.gray500};
  letter-spacing: 0.1px;
`;

const ItemValue = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const IncidentTitle = styled(PageHeading, {
  shouldForwardProp: p => isPropValid(p) && p !== 'loading',
})<{loading: boolean}>`
  ${p => p.loading && 'opacity: 0'};
  line-height: 1.5;
`;

const IncidentSubTitle = styled('div', {
  shouldForwardProp: p => isPropValid(p) && p !== 'loading',
})<{loading: boolean}>`
  ${p => p.loading && 'opacity: 0'};
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray500};
`;

const StyledStatus = styled(Status)`
  margin-right: ${space(2)};
`;

const StatusMenuItem = styled(MenuItem)`
  > span {
    padding: ${space(1)} ${space(1.5)};
    font-size: ${p => p.theme.fontSizeSmall};
    font-weight: 600;
    line-height: 1;
    text-align: left;
    display: grid;
    grid-template-columns: max-content 1fr;
    grid-gap: ${space(0.75)};
    align-items: center;
  }
`;
