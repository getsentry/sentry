import {Component} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import Button from 'app/components/button';
import DropdownMenu from 'app/components/dropdownMenu';
import {IconChevron, IconOpen, IconStack} from 'app/icons';
import {
  getDiscoverUrlPathFromDiscoverQuery,
  getDiscover2UrlPathFromDiscoverQuery,
} from 'app/views/dashboards/utils/getDiscoverUrlPathFromDiscoverQuery';
import {getEventsUrlPathFromDiscoverQuery} from 'app/views/dashboards/utils/getEventsUrlPathFromDiscoverQuery';

class ExploreWidget extends Component {
  static propTypes = {
    widget: SentryTypes.Widget,
    organization: SentryTypes.Organization,
    selection: SentryTypes.GlobalSelection,
  };

  getExportToDiscover = (query, isDiscover2 = false) => {
    const {selection, organization} = this.props;
    return isDiscover2
      ? getDiscover2UrlPathFromDiscoverQuery({organization, selection, query})
      : getDiscoverUrlPathFromDiscoverQuery({organization, selection, query});
  };

  getExportToEvents = query => {
    const {selection, organization} = this.props;
    return getEventsUrlPathFromDiscoverQuery({
      organization,
      selection,
      query,
    });
  };

  // TODO(discover1): Can be removed when Discover1 is deprecated
  // Copied from https://github.com/getsentry/sentry/blob/8d31f8651558b3f9a5f65dc45e0f439c5ac19d55/src/sentry/static/sentry/app/components/sidebar/index.jsx#L230-L278
  getDiscoverFlags(organization) {
    const flags = {
      discover1: false,
      discover2: false,
      events: false,
    };

    // Bail as we can't do any more checks.
    if (!organization || !organization.features) {
      return flags;
    }

    // Localstorage returns either null, 1 or 2. Default to 2.
    const version = String(localStorage.getItem('discover:version') || 2);
    const features = organization.features;

    if (features.includes('discover-basic')) {
      // If there is no opt-out state show discover2
      if (!version || version === '2') {
        flags.discover2 = true;
      }
      // User wants discover1
      if (version === '1') {
        flags.discover1 = true;
        flags.events = true;
      }
      return flags;
    }

    // If an account has the old features they continue to have
    // access to them.
    if (features.includes('discover')) {
      flags.discover1 = true;
    }
    if (features.includes('events')) {
      flags.events = true;
    }

    // If an organization doesn't have events, or discover-basic
    // Enable the tab so we can show an upsell state in saas.
    if (!flags.events) {
      flags.discover2 = true;
    }

    return flags;
  }

  renderActionToDiscover1(query, flags) {
    // Hide if preference is Discover2
    if (flags.discover2) {
      return null;
    }

    if (!flags.discover1) {
      return null;
    }

    return (
      <ExploreAction
        to={this.getExportToDiscover(query)}
        title={
          flags.discover1
            ? t('Explore data in Discover')
            : t('You do not have access to Discover')
        }
      >
        <IconOpen />
      </ExploreAction>
    );
  }

  renderActionToDiscover2(query, flags) {
    // If Discover1 is the preference, do not show
    if (flags.discover1 && flags.events && !flags.discover2) {
      return null;
    }

    return (
      <ExploreAction
        to={flags.discover2 ? this.getExportToDiscover(query, true) : ''}
        href={!flags.discover2 ? 'https://docs.sentry.io/product/discover-queries/' : ''}
        target={!flags.discover2 ? '_blank' : ''}
        title={
          flags.discover2
            ? t('Explore data in Discover')
            : t('You do not have access to Discover. Click to learn more.')
        }
      >
        <IconOpen />
      </ExploreAction>
    );
  }

  renderActionToEvent(query, flags) {
    // Hide if preference is Discover2
    if (flags.discover2) {
      return null;
    }

    if (!flags.events) {
      return null;
    }

    return (
      <ExploreAction
        to={this.getExportToEvents(query)}
        title={
          flags.events
            ? t('Explore data in Events')
            : t('You do not have access to Events')
        }
      >
        <IconStack />
      </ExploreAction>
    );
  }

  render() {
    const {organization, widget} = this.props;
    const discoverQueries = widget.queries.discover;
    const flags = this.getDiscoverFlags(organization);

    return (
      <DropdownMenu>
        {({isOpen, getRootProps, getActorProps, getMenuProps}) => (
          <ExploreRoot {...getRootProps()} isOpen={isOpen}>
            <div {...getActorProps()}>
              <ExploreButton isOpen={isOpen}>
                {t('Explore Data')}
                <Chevron
                  isOpen={isOpen}
                  direction={isOpen ? 'down' : 'right'}
                  size="xs"
                />
              </ExploreButton>
            </div>
            <ExploreMenu {...getMenuProps({isOpen})}>
              {discoverQueries.map(query => (
                <ExploreRow key={query.name}>
                  <QueryName>{query.name}</QueryName>

                  {this.renderActionToDiscover1(query, flags)}
                  {this.renderActionToDiscover2(query, flags)}
                  {this.renderActionToEvent(query, flags)}
                </ExploreRow>
              ))}
            </ExploreMenu>
          </ExploreRoot>
        )}
      </DropdownMenu>
    );
  }
}
export default withOrganization(ExploreWidget);

const ExploreRoot = styled('div')`
  border-left: 1px solid ${p => p.theme.borderLight};
  position: relative;
  ${p => p.isOpen && 'filter: drop-shadow(-7px -7px 12px rgba(47, 40, 55, 0.04));'};
`;

const ExploreAction = props => <Button priority="link" {...props} />;

const ExploreButton = styled(props => {
  const remaining = omit(props, 'isOpen');
  return <ExploreAction {...remaining} />;
})`
  position: relative;
  color: ${p => (p.isOpen ? p.theme.purple400 : p.theme.gray500)};
  padding: ${space(1)} ${space(2)};
  border-radius: 0 0 ${p => p.theme.borderRadius} 0;
  ${p => p.isOpen && `z-index: ${p.theme.zIndex.dropdownAutocomplete.actor}`};

  &:hover {
    color: ${p => p.theme.purple400};
  }

  /* covers up borders to create a continous shape */
  ${p => (p.isOpen ? '&, &:hover, &:active { box-shadow: 0 -1px 0 #fff; }' : '')}
`;

const ExploreMenu = styled('div')`
  visibility: ${p => (p.isOpen ? 'visible' : 'hidden')};
  display: flex;
  flex-direction: column;
  min-width: 250px;

  position: absolute;
  right: -1px;
  bottom: 100%;
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.menu};

  background-color: white;
  border: 1px solid ${p => p.theme.borderLight};
`;

const ExploreRow = styled('li')`
  display: flex;
  align-items: center;
  padding: 0 ${space(0.5)};
`;

const QueryName = styled('span')`
  flex-grow: 1;
  white-space: nowrap;
  font-size: 0.9em;
  margin: ${space(1)};
  margin-right: ${space(2)};
`;

const Chevron = styled(IconChevron, {shouldForwardProp: prop => prop !== 'isOpen'})`
  ${p => (p.isOpen ? 'transform: rotate(180deg);' : '')};
  margin-left: ${p => (p.isOpen ? space(0.5) : space(0.25))};
  transition: all 0.25s;
`;
