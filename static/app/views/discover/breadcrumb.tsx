import {Fragment} from 'react';
import type {Location} from 'history';
import omit from 'lodash/omit';

import {Container, Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import type {Crumb} from 'sentry/components/breadcrumbs';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {IconSlashForward} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {EventView} from 'sentry/utils/discover/eventView';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';
import {EventInputName} from 'sentry/views/discover/eventInputName';
import {makeDiscoverPathname} from 'sentry/views/discover/pathnames';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  event?: Event;
  isHomepage?: boolean;
  savedQuery?: SavedQuery;
};

export function DiscoverBreadcrumb({
  eventView,
  event,
  organization,
  location,
  isHomepage,
  savedQuery,
}: Props) {
  const hasPageFrameFeature = useHasPageFrameFeature();
  const crumbs: Crumb[] = [];
  const discoverTarget = organization.features.includes('discover-query')
    ? {
        pathname: getDiscoverLandingUrl(organization),
        query: {
          ...omit(location.query, 'homepage'),
          ...eventView.generateBlankQueryStringObject(),
          ...eventView.getPageFiltersQuery(),
        },
      }
    : null;

  crumbs.push({
    to:
      isHomepage && eventView
        ? eventView.getResultsViewUrlTarget(organization, isHomepage)
        : discoverTarget,
    label: t('Discover'),
  });

  if (!isHomepage && eventView?.isValid()) {
    if (defined(eventView.id)) {
      crumbs.push({
        to: makeDiscoverPathname({
          path: '/queries/',
          organization,
        }),
        label: t('Saved Queries'),
      });
    }

    if (hasPageFrameFeature && !event) {
      return (
        <Flex
          as="nav"
          gap="xs"
          align="center"
          padding="md 0"
          data-test-id="breadcrumb-list"
        >
          {crumbs.map((crumb, index) => (
            <Fragment key={index}>
              <DiscoverBreadcrumbItem crumb={crumb} />
              <Flex align="center" justify="center" flexShrink={0}>
                <IconSlashForward size="xs" variant="muted" />
              </Flex>
            </Fragment>
          ))}
          <Container maxWidth="400px" width="auto">
            <EventInputName
              savedQuery={savedQuery}
              organization={organization}
              eventView={eventView}
              isHomepage={isHomepage}
            />
          </Container>
        </Flex>
      );
    }

    crumbs.push({
      label: eventView.name || '',
    });
  }

  if (event) {
    crumbs.push({
      label: t('Event Detail'),
    });
  }

  return <Breadcrumbs crumbs={crumbs} />;
}

function DiscoverBreadcrumbItem({crumb}: {crumb: Crumb}) {
  function onBreadcrumbLinkClick() {
    if (crumb.to) {
      trackAnalytics('breadcrumbs.link.clicked', {organization: null});
    }
  }

  return (
    <Container maxWidth="400px" width="auto">
      {styleProps =>
        crumb.to ? (
          <Link
            to={crumb.to}
            preservePageFilters={crumb.preservePageFilters}
            data-test-id="breadcrumb-link"
            onClick={onBreadcrumbLinkClick}
            {...styleProps}
          >
            <Text ellipsis variant="muted">
              {crumb.label}
            </Text>
          </Link>
        ) : (
          <Text ellipsis variant="muted" data-test-id="breadcrumb-item" {...styleProps}>
            {crumb.label}
          </Text>
        )
      }
    </Container>
  );
}
