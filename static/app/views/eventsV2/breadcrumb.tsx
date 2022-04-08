import {Component} from 'react';
import {Location} from 'history';

import Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';

type DefaultProps = {
  event: Event | undefined;
};

type Props = DefaultProps & {
  eventView: EventView;
  location: Location;
  organization: Organization;
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
            ...eventView.getPageFiltersQuery(),
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
