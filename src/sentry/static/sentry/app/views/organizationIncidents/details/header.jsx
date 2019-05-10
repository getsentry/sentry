import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import PageHeading from 'app/components/pageHeading';
import Link from 'app/components/links/link';
import InlineSvg from 'app/components/inlineSvg';
import {PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import SubscribeButton from 'app/components/subscribeButton';
import DropdownControl from 'app/components/dropdownControl';
import MenuItem from 'app/components/menuItem';
import Access from 'app/components/acl/access';
import DropdownButton from 'app/components/dropdownButton';

import Status from '../status';
import {isOpen} from '../utils';

export default class DetailsHeader extends React.Component {
  static propTypes = {
    incident: SentryTypes.Incident,
    params: PropTypes.object.isRequired,
    onSubscriptionChange: PropTypes.func.isRequired,
    onStatusChange: PropTypes.func.isRequired,
  };

  renderStatus() {
    const {incident, onStatusChange} = this.props;

    const isIncidentOpen = isOpen(incident);

    return (
      <Access
        access={['org:write']}
        renderNoAccessMessage={() => <Status incident={incident} />}
      >
        <DropdownControl
          button={
            // eslint-disable-next-line no-shadow
            ({getActorProps, isOpen}) => (
              <DropdownButton {...getActorProps()} isOpen={isOpen}>
                <Status incident={incident} />
              </DropdownButton>
            )
          }
          menuWidth="160px"
        >
          <StyledMenuItem onSelect={onStatusChange}>
            {isIncidentOpen ? t('Close this incident') : t('Reopen this incident')}
          </StyledMenuItem>
        </DropdownControl>
      </Access>
    );
  }

  render() {
    const {incident, params, onSubscriptionChange} = this.props;

    return (
      <Header>
        <HeaderItem>
          <PageHeading>
            <Title>
              <IncidentsLink to={`/organizations/${params.orgId}/incidents/`}>
                {t('Incidents')}
              </IncidentsLink>
              <Chevron src="icon-chevron-right" size={space(2)} />
              {params.incidentId}
            </Title>
            <div>{incident && incident.title}</div>
          </PageHeading>
        </HeaderItem>
        {incident && (
          <GroupedHeaderItems>
            <HeaderItem>
              <ItemTitle>{t('Status')}</ItemTitle>
              <ItemValue>{this.renderStatus()}</ItemValue>
            </HeaderItem>
            <HeaderItem>
              <ItemTitle>{t('Event count')}</ItemTitle>
              <ItemValue>{incident.eventCount}</ItemValue>
            </HeaderItem>
            <HeaderItem>
              <ItemTitle>{t('Users affected')}</ItemTitle>
              <ItemValue>{incident.usersAffected}</ItemValue>
            </HeaderItem>
            <HeaderItem>
              <ItemTitle>{t('Notifications')}</ItemTitle>
              <ItemValue>
                <SubscribeButton
                  isSubscribed={incident.isSubscribed}
                  onClick={onSubscriptionChange}
                />
              </ItemValue>
            </HeaderItem>
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
`;

const GroupedHeaderItems = styled('div')`
  display: flex;
  text-align: right;
`;

const HeaderItem = styled('div')`
  padding: ${space(3)};
`;

const ItemTitle = styled('h6')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: ${space(1)};
  text-transform: uppercase;
  color: ${p => p.theme.gray2};
  letter-spacing: 0.1px;
`;

const ItemValue = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  font-size: ${p => p.theme.headerFontSize};
  height: 34px;
`;

const Title = styled('div')`
  margin-bottom: ${space(2)};
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
