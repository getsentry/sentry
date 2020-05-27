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
import ProjectBadge from 'app/components/idBadge/projectBadge';
import Projects from 'app/utils/projects';
import SubscribeButton from 'app/components/subscribeButton';
import getDynamicText from 'app/utils/getDynamicText';
import space from 'app/styles/space';
import {IconCheckmark} from 'app/icons';
import Breadcrumbs from 'app/components/breadcrumbs';
import Button from 'app/components/button';
import {Dataset} from 'app/views/settings/incidentRules/types';

import {Incident, IncidentStats, IncidentStatus} from '../types';
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
  render() {
    const {
      hasIncidentDetailsError,
      incident,
      params,
      stats,
      onSubscriptionChange,
      onStatusChange,
    } = this.props;
    const isIncidentReady = !!incident && !hasIncidentDetailsError;
    const dateStarted = incident && moment(new Date(incident.dateStarted)).format('llll');
    const duration =
      incident &&
      moment(incident.dateClosed ? new Date(incident.dateClosed) : new Date()).diff(
        moment(new Date(incident.dateStarted)),
        'seconds'
      );
    const isErrorDataset = incident?.alertRule?.dataset === Dataset.ERRORS;

    const project = incident && incident.projects && incident.projects[0];

    return (
      <React.Fragment>
        <BreadCrumbBar>
          <AlertBreadcrumbs
            crumbs={[
              {label: t('Alerts'), to: `/organizations/${params.orgId}/alerts/`},
              {label: incident && `#${incident.id}`},
            ]}
          />
          <AlertControls>
            <SubscribeButton
              disabled={!isIncidentReady}
              isSubscribed={incident?.isSubscribed}
              onClick={onSubscriptionChange}
              size="small"
            />
            <Button
              icon={<IconCheckmark />}
              disabled={!isIncidentReady || incident?.status === IncidentStatus.CLOSED}
              size="small"
              onClick={onStatusChange}
            >
              {t('Resolve')}
            </Button>
          </AlertControls>
        </BreadCrumbBar>
        <Header>
          <div>
            <IncidentTitle data-test-id="incident-title" loading={!isIncidentReady}>
              {incident && !hasIncidentDetailsError ? incident.title : 'Loading'}
            </IncidentTitle>
            <IncidentSubTitle loading={!isIncidentReady}>
              Triggered: {dateStarted}
            </IncidentSubTitle>
          </div>

          {hasIncidentDetailsError ? (
            <StyledLoadingError />
          ) : (
            <GroupedHeaderItems>
              <ItemTitle>{t('Status')}</ItemTitle>
              <ItemTitle>{t('Project')}</ItemTitle>
              {isErrorDataset && stats && <ItemTitle>{t('Users affected')}</ItemTitle>}
              {isErrorDataset && stats && <ItemTitle>{t('Total events')}</ItemTitle>}
              <ItemTitle>{t('Duration')}</ItemTitle>
              <ItemValue>{incident && <Status incident={incident} />}</ItemValue>
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
              {isErrorDataset && stats && (
                <ItemValue>
                  <Count value={stats.uniqueUsers} />
                </ItemValue>
              )}
              {isErrorDataset && stats && (
                <ItemValue>
                  <Count value={stats.totalEvents} />
                </ItemValue>
              )}
              {incident && (
                <ItemValue>
                  <Duration
                    seconds={getDynamicText({value: duration || 0, fixed: 1200})}
                  />
                </ItemValue>
              )}
            </GroupedHeaderItems>
          )}
        </Header>
      </React.Fragment>
    );
  }
}

const BreadCrumbBar = styled('div')`
  background-color: ${p => p.theme.offWhite};
  margin-bottom: 0;
  padding: ${space(2)} ${space(4)};

  display: flex;
`;

const AlertBreadcrumbs = styled(Breadcrumbs)`
  flex-grow: 1;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  padding: 0;
`;

const AlertControls = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
`;

const Header = styled(PageHeader)`
  background-color: ${p => p.theme.offWhite};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  margin-bottom: 0;
  padding: ${space(2)} ${space(4)};

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
  grid-template-columns: repeat(5, max-content);
  grid-gap: ${space(1)} ${space(4)};
  text-align: right;
  margin-top: ${space(1)};

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
  color: ${p => p.theme.gray2};
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
