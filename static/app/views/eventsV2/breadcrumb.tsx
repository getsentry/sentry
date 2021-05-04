import {Component} from 'react';
import {Location} from 'history';

import Breadcrumbs, {Crumb} from 'app/components/breadcrumbs';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {Event} from 'app/types/event';
import EventView from 'app/utils/discover/eventView';
import {getDiscoverLandingUrl} from 'app/utils/discover/urls';

type DefaultProps = {
  event: Event | undefined;
};

type Props = DefaultProps & {
  eventView: EventView;
  organization: Organization;
  location: Location;
};

class DiscoverBreadcrumb extends Component<Props> {
  static defaultProps: DefaultProps = {
    event: undefined,
  };

  getCrumbs() {
    const crumbs: Crumb[] = [];
    const {eventView, event, organization, location} = this.props;
    const discoverTarget = organization.features.includes('discover-query')
      ? {
          pathname: getDiscoverLandingUrl(organization),
          query: {
            ...location.query,
            ...eventView.generateBlankQueryStringObject(),
            ...eventView.getGlobalSelectionQuery(),
          },
        }
      : null;

    crumbs.push({
      to: discoverTarget,
      label: t('Discover'),
    });

    if (eventView && eventView.isValid()) {
      crumbs.push({
        to: eventView.getResultsViewUrlTarget(organization.slug),
        label: eventView.name || '',
      });
    }

    if (event) {
      crumbs.push({
        label: t('Event Detail'),
      });
    }

    return crumbs;
  }

  render() {
    return <Breadcrumbs crumbs={this.getCrumbs()} />;
  }
}

export default DiscoverBreadcrumb;
