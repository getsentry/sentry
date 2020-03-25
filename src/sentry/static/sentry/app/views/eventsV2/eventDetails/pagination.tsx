import React from 'react';
import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import {t} from 'app/locale';
import Link from 'app/components/links/link';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import {Event, Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';

import {generateEventDetailsRoute} from './utils';

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
      links[key] = {
        pathname: generateEventDetailsRoute({eventSlug, orgSlug: organization.slug}),
        query: eventView.generateQueryStringObject(),
      };
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
    <Paginator>
      <StyledIconLink
        to={links.oldest}
        disabled={links.previous === null || links.oldest === null}
      >
        <InlineSvg src="icon-prev" />
      </StyledIconLink>
      <StyledTextLink
        data-test-id="older-event"
        to={links.previous}
        disabled={links.previous === null}
      >
        {t('Older')}
      </StyledTextLink>
      <StyledTextLink
        data-test-id="newer-event"
        to={links.next}
        disabled={links.next === null}
      >
        {t('Newer')}
      </StyledTextLink>
      <StyledIconLink
        to={links.latest}
        disabled={links.next === null || links.latest === null}
        isLast
      >
        <InlineSvg src="icon-next" />
      </StyledIconLink>
    </Paginator>
  );
};

const StyledTextLink = styled(Link, {shouldForwardProp: isPropValid})<{
  theme: any;
  disabled: boolean;
  isLast: boolean;
}>`
  color: ${p => (p.disabled ? p.theme.disabled : 'inherit')};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  padding: ${space(0.25)};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-grow: 2;
  ${p => (p.isLast ? '' : `border-right: 1px solid ${p.theme.borderDark};`)}
  ${p => (p.disabled ? 'pointer-events: none;' : '')}

  &:hover,
  &:active {
    color: inherit;
  }

  &:active {
    box-shadow: inset 0 2px rgba(0, 0, 0, 0.05);
  }
`;

const StyledIconLink = styled(StyledTextLink, {shouldForwardProp: isPropValid})`
  flex-grow: 1;
`;

const Paginator = styled('div')`
  display: flex;
  flex-grow: 1;
  background: ${p => p.theme.white};
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 2px rgba(0, 0, 0, 0.05);
  margin-top: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-left: ${space(1.5)};
    margin-top: 0;
  }
`;

export default Pagination;
