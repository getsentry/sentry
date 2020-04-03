import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {IconPrevious, IconNext} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Event, Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {eventDetailsRouteWithEventView} from 'app/utils/discover/urls';

type LinksType = {
  oldest: null;
  latest: null;

  next: {};
  previous: {};
};

/**
 * Generate a mapping of link names => link targets for pagination
 */
function buildTargets(
  event: Event,
  eventView: EventView,
  organization: Organization
): LinksType {
  const urlMap: {[k in keyof LinksType]: string | undefined | null} = {
    previous: event.previousEventID,
    next: event.nextEventID,
    oldest: event.oldestEventID,
    latest: event.latestEventID,
  };

  const links: {[k in keyof LinksType]?: any} = {};

  Object.entries(urlMap).forEach(([key, eventSlug]) => {
    // If the urlMap has no value we want to skip this link as it is 'disabled';
    if (!eventSlug) {
      links[key] = null;
    } else {
      links[key] = eventDetailsRouteWithEventView({
        eventSlug,
        eventView,
        orgSlug: organization.slug,
      });
    }
  });

  return links as LinksType;
}

type Props = {
  event: Event;
  organization: Organization;
  eventView: EventView;
};

const Pagination = (props: Props) => {
  const {event, organization, eventView} = props;
  const links = buildTargets(event, eventView, organization);

  return (
    <Paginator merged>
      <Button
        size="small"
        to={links.oldest || ''}
        disabled={links.previous === null || links.oldest === null}
        icon={<IconPrevious size="xs" />}
      />
      <Button
        size="small"
        data-test-id="older-event"
        to={links.previous}
        disabled={links.previous === null}
      >
        {t('Older')}
      </Button>
      <Button
        size="small"
        data-test-id="newer-event"
        to={links.next}
        disabled={links.next === null}
      >
        {t('Newer')}
      </Button>
      <Button
        size="small"
        to={links.latest || ''}
        disabled={links.next === null || links.latest === null}
        icon={<IconNext size="xs" />}
      />
    </Paginator>
  );
};

const Paginator = styled(ButtonBar)`
  margin-top: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-left: ${space(1.5)};
    margin-top: 0;
  }
`;

export default Pagination;
