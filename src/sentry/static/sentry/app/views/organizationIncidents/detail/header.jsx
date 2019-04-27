import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import PageHeading from 'app/components/pageHeading';
import Link from 'app/components/link';
import InlineSvg from 'app/components/inlineSvg';
import {PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';

export default class IncidentHeader extends React.Component {
  static propTypes = {
    params: PropTypes.object.isRequired,
    incident: SentryTypes.Incident,
  };

  render() {
    const {incident, params} = this.props;

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
            <div>{incident && incident.name}</div>
          </PageHeading>
        </HeaderItem>
        {incident && (
          <GroupedHeaderItems>
            <HeaderItem>
              <ItemTitle>{t('Event count')}</ItemTitle>
              <ItemValue>{incident.eventCount}</ItemValue>
            </HeaderItem>
            <HeaderItem>
              <ItemTitle>{t('Users affected')}</ItemTitle>
              <ItemValue>{incident.usersAffected}</ItemValue>
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
  border-bottom: 1px dotted ${p => p.theme.gray2};
`;

const ItemValue = styled('span')`
  font-size: ${p => p.theme.headerFontSize};
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
