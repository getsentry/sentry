import React from 'react';
import styled from 'react-emotion';

import {getDiscoverUrlPathFromDiscoverQuery} from 'app/views/organizationDashboard/utils/getDiscoverUrlPathFromDiscoverQuery';
import {getEventsUrlPathFromDiscoverQuery} from 'app/views/organizationDashboard/utils/getEventsUrlPathFromDiscoverQuery';
import {t} from 'app/locale';
import Button from 'app/components/button';
import DropdownMenu from 'app/components/dropdownMenu';
import Feature from 'app/components/acl/feature';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

class ExploreWidget extends React.Component {
  static propTypes = {
    widget: SentryTypes.Widget,
    organization: SentryTypes.Organization,
    selection: SentryTypes.GlobalSelection,
  };

  getExportToDiscover = query => {
    const {selection, organization} = this.props;
    return getDiscoverUrlPathFromDiscoverQuery({
      organization,
      selection,
      query,
    });
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
    const {organization, widget} = this.props;
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

                    <Feature features={['discover']} organization={organization}>
                      {({hasFeature}) => (
                        <ExploreAction
                          to={this.getExportToDiscover(query)}
                          disabled={!hasFeature}
                          title={
                            hasFeature ? '' : t('You do not have access to Discover')
                          }
                        >
                          <InlineSvg src="icon-discover" />
                        </ExploreAction>
                      )}
                    </Feature>

                    <Feature features={['events']} organization={organization}>
                      {({hasFeature}) => (
                        <ExploreAction
                          to={this.getExportToEvents(query)}
                          disabled={!hasFeature}
                          title={hasFeature ? '' : t('You do not have access to Events')}
                        >
                          <InlineSvg src="icon-stack" />
                        </ExploreAction>
                      )}
                    </Feature>
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
