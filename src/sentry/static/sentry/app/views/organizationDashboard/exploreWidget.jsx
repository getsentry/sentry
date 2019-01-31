import {pickBy} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {getEventsUrlPathFromDiscoverQuery} from 'app/views/organizationDashboard/utils/getEventsUrlPathFromDiscoverQuery';
import {getQueryStringFromQuery} from 'app/views/organizationDiscover/utils';
import {t} from 'app/locale';
import Button from 'app/components/button';
import DropdownMenu from 'app/components/dropdownMenu';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

class ExploreWidget extends React.Component {
  static propTypes = {
    widget: SentryTypes.Widget,
    queries: PropTypes.arrayOf(SentryTypes.DiscoverQuery),
    organization: SentryTypes.Organization,
    selection: SentryTypes.GlobalSelection,
    router: PropTypes.object,
  };

  getExportToDiscover = query => {
    const {organization} = this.props;
    const {
      datetime,
      environments, // eslint-disable-line no-unused-vars
      ...selection
    } = this.props.selection;

    // Discover does not support importing these
    const {
      groupby, // eslint-disable-line no-unused-vars
      rollup, // eslint-disable-line no-unused-vars
      orderby,
      ...restQuery
    } = query;

    const orderbyTimeIndex = orderby.indexOf('time');
    let visual = 'table';

    if (orderbyTimeIndex !== -1) {
      restQuery.orderby = `${orderbyTimeIndex === 0 ? '' : '-'}${restQuery
        .aggregations[0][2]}`;
      visual = 'line-by-day';
    } else {
      restQuery.orderby = orderby;
    }

    return `/organizations/${organization.slug}/discover/${getQueryStringFromQuery(
      pickBy({
        ...restQuery,
        ...selection,
        start: datetime.start,
        end: datetime.end,
        range: datetime.period,
        limit: 1000,
      })
    )}&visual=${visual}`;
  };

  getExportToEvents = query => {
    const {selection, organization} = this.props;
    return getEventsUrlPathFromDiscoverQuery({
      organization,
      selection,
      query,
    });
  };

  render() {
    const {widget} = this.props;
    const discoverQueries = widget.queries.discover;

    return (
      <DropdownMenu>
        {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
          return (
            <ExploreRoot {...getRootProps()}>
              <div {...getActorProps()}>
                <ExploreButton isOpen={isOpen}>
                  {t('Explore Data')}
                  <Chevron isOpen={isOpen} src="icon-chevron-right" />
                </ExploreButton>
              </div>
              <ExploreMenu {...getMenuProps({isStyled: true, isOpen})}>
                {discoverQueries.map(query => (
                  <ExploreRow key={query.name}>
                    <QueryName>{query.name}</QueryName>

                    <ExploreAction to={this.getExportToDiscover(query)}>
                      <InlineSvg src="icon-discover" />
                    </ExploreAction>
                    <ExploreAction to={this.getExportToEvents(query)}>
                      <InlineSvg src="icon-stack" />
                    </ExploreAction>
                  </ExploreRow>
                ))}
              </ExploreMenu>
            </ExploreRoot>
          );
        }}
      </DropdownMenu>
    );
  }
}
export default withOrganization(ExploreWidget);

const ExploreRoot = styled('div')`
  border-left: 1px solid ${p => p.theme.borderLight};
  position: relative;
`;

const UnstyledButton = props => <Button borderless size="zero" {...props} />;

const ExploreButton = styled(({isOpen, ...props}) => <UnstyledButton {...props} />)`
  position: relative;
  color: ${p => (p.isOpen ? p.theme.purple : p.theme.gray2)};
  padding: ${space(1)} ${space(2)};
  border-radius: 0 0 ${p => p.theme.borderRadius} 0;
  ${p => p.isOpen && `z-index: ${p.theme.zIndex.dropdownAutocomplete.actor}`};
  ${p => p.isOpen && `box-shadow: ${p.theme.dropShadowHeavy}`};
  &:hover {
    color: ${p => p.theme.purple};
  }
  transition: box-shadow 0.25s;
`;

const ExploreMenu = styled('div')`
  display: ${p => (p.isOpen ? 'flex' : 'none')};
  flex-direction: column;

  position: absolute;
  right: -1px;
  bottom: calc(100% - 1px);
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.menu};

  background-color: white;
  border: 1px solid ${p => p.theme.borderLight};
  box-shadow: ${p => p.theme.dropShadowHeavy};
`;

const ExploreRow = styled('li')`
  display: flex;
  align-items: center;
  padding: 0 ${space(0.5)};
`;

const ExploreAction = styled(UnstyledButton)`
  padding: ${space(1)};
  color: ${p => p.theme.purple};
  &:hover {
    color: ${p => p.theme.purpleDark};
  }
`;

const QueryName = styled('span')`
  flex-grow: 1;
  white-space: nowrap;
  font-size: 0.9em;
  margin: ${space(1)};
  margin-right: ${space(2)};
`;

const Chevron = styled(InlineSvg)`
  ${p => (p.isOpen ? `transform: rotate(-90deg);` : '')};
  transition: transform 0.25s;
`;
