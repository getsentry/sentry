import React from 'react';
import styled from 'react-emotion';
import isPropValid from '@emotion/is-prop-valid';

import {t} from 'app/locale';
import Link from 'app/components/links/link';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import {Event, Organization} from 'app/types';

import {generateEventDetailsRoute} from './utils';
import EventView from '../eventView';

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

  Object.entries(urlMap).forEach(([key, value]) => {
    // If the urlMap has no value we want to skip this link as it is 'disabled';
    if (!value) {
      links[key] = null;
    } else {
      const eventSlug = `${event.projectSlug}:${value}`;

      links[key] = {
        pathname: generateEventDetailsRoute({eventSlug, organization}),
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
        <InlineSvg src="icon-prev" size="14px" />
      </StyledIconLink>
      <StyledTextLink
        data-test-id="older-event"
        to={links.previous}
        disabled={links.previous === null}
      >
        {t('Older Event')}
      </StyledTextLink>
      <StyledTextLink
        data-test-id="newer-event"
        to={links.next}
        disabled={links.next === null}
      >
        {t('Newer Event')}
      </StyledTextLink>
      <StyledIconLink
        to={links.latest}
        disabled={links.next === null || links.latest === null}
        isLast
      >
        <InlineSvg src="icon-next" size="14px" />
      </StyledIconLink>
    </Paginator>
  );
};

const StyledTextLink = styled(Link, {shouldForwardProp: isPropValid})<{
  theme: any;
  disabled: boolean;
  isLast: boolean;
}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.gray3)};
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(0.5)} ${space(1.5)};
  text-align: center;
  flex-grow: 2;
  ${p => (p.isLast ? '' : `border-right: 1px solid ${p.theme.borderDark};`)}
  ${p => (p.disabled ? 'pointer-events: none;' : '')}
`;

const StyledIconLink = styled(StyledTextLink)`
  flex-grow: 1;
`;

const Paginator = styled('div')`
  display: flex;
  background: ${p => p.theme.offWhite};
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(1)};
`;

export default Pagination;
