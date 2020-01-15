import {Link} from 'react-router';
import {Params} from 'react-router/lib/Router';
import React from 'react';
import moment from 'moment';
import styled from '@emotion/styled';

import {PageHeader} from 'app/styles/organization';
import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import Count from 'app/components/count';
import DropdownControl from 'app/components/dropdownControl';
import Duration from 'app/components/duration';
import InlineSvg from 'app/components/inlineSvg';
import LoadingError from 'app/components/loadingError';
import MenuItem from 'app/components/menuItem';
import PageHeading from 'app/components/pageHeading';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import Projects from 'app/utils/projects';
import SubscribeButton from 'app/components/subscribeButton';
import getDynamicText from 'app/utils/getDynamicText';
import isPropValid from '@emotion/is-prop-valid';
import space from 'app/styles/space';

import {Incident} from '../types';
import {isOpen} from '../utils';
import Status from '../status';

type Props = {
  className?: string;
  hasIncidentDetailsError: boolean;
  // Can be undefined when loading
  incident?: Incident;
  onSubscriptionChange: (event: React.MouseEvent) => void;
  onStatusChange: (eventKey: any) => void;
  params: Params;
};

export default class DetailsHeader extends React.Component<Props> {
  renderStatus() {
    const {incident, onStatusChange} = this.props;

    const isIncidentOpen = incident && isOpen(incident);

    return (
      <Access
        access={['org:write']}
        renderNoAccessMessage={() => (incident ? <Status incident={incident} /> : null)}
      >
        <DropdownControl
          data-test-id="status-dropdown"
          label={incident && <Status incident={incident} />}
          menuWidth="160px"
          alignRight
          buttonProps={{size: 'small', disabled: !incident}}
        >
          <StyledMenuItem onSelect={onStatusChange}>
            {isIncidentOpen ? t('Close this incident') : t('Reopen this incident')}
          </StyledMenuItem>
        </DropdownControl>
      </Access>
    );
  }

  render() {
    const {hasIncidentDetailsError, incident, params, onSubscriptionChange} = this.props;
    const isIncidentReady = !!incident && !hasIncidentDetailsError;
    const eventLink = incident
      ? {
          pathname: `/organizations/${params.orgId}/events/`,

          // Note we don't have project selector on here so there should be
          // no query params to forward
          query: {
            group: incident.groups,
          },
        }
      : '';

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
          <Breadcrumb>
            <IncidentsLink to={`/organizations/${params.orgId}/incidents/`}>
              {t('Incidents')}
            </IncidentsLink>
            {dateStarted && (
              <React.Fragment>
                <Chevron src="icon-chevron-right" size={space(2)} />
                <IncidentDate>{dateStarted}</IncidentDate>
              </React.Fragment>
            )}
          </Breadcrumb>
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
                    <ProjectBadge project={projects && projects.length && projects[0]} />
                  )}
                </Projects>
              )}
            </ItemValue>
            {incident && (
              <ItemValue>
                <Duration seconds={getDynamicText({value: duration || 0, fixed: 1200})} />
              </ItemValue>
            )}
            {incident && (
              <ItemValue>
                <Count value={incident.uniqueUsers} />
              </ItemValue>
            )}
            {incident && (
              <ItemValue>
                <Count value={incident.totalEvents} />
                <OpenLink to={eventLink}>
                  <InlineSvg src="icon-open" size="14" />
                </OpenLink>
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
  grid-column-gap: ${space(3)};
  grid-row-gap: ${space(1)};
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

const Breadcrumb = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(0.5)};
`;

const IncidentTitle = styled('div', {
  shouldForwardProp: p => isPropValid(p) && p !== 'loading',
})<{loading: boolean}>`
  ${p => p.loading && 'opacity: 0'};
`;

const IncidentDate = styled('div')`
  font-size: 0.8em;
  color: ${p => p.theme.gray2};
`;

const IncidentsLink = styled(Link)`
  color: inherit;
`;

const Chevron = styled(InlineSvg)`
  color: ${p => p.theme.gray1};
  margin: 0 ${space(0.5)};
`;

const StyledMenuItem = styled(MenuItem)`
  font-size: ${p => p.theme.fontSizeMedium};
  text-align: left;
  padding: ${space(1)};
`;

const OpenLink = styled(Link)`
  display: flex;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray2};
  margin-left: ${space(1)};
`;
