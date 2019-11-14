import React from 'react';
import styled from 'react-emotion';
import isPropValid from '@emotion/is-prop-valid';

import {t} from 'app/locale';
import Link from 'app/components/links/link';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import {Event, Organization} from 'app/types';

import {generateEventDetailsRoute} from './eventDetails/utils';
import EventView from './eventView';

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

const ModalPagination = (props: Props) => {
  const {event, organization, eventView} = props;
  const links = buildTargets(event, eventView, organization);

  return (
    <Wrapper>
      <ShadowBox>
        <StyledLink
          to={links.oldest}
          disabled={links.previous === null || links.oldest === null}
        >
          <InlineSvg src="icon-prev" size="14px" />
        </StyledLink>
        <StyledLink
          data-test-id="older-event"
          to={links.previous}
          disabled={links.previous === null}
        >
          {t('Older Event')}
        </StyledLink>
        <StyledLink
          data-test-id="newer-event"
          to={links.next}
          disabled={links.next === null}
        >
          {t('Newer Event')}
        </StyledLink>
        <StyledLink
          to={links.latest}
          disabled={links.next === null || links.latest === null}
          isLast
        >
          <InlineSvg src="icon-next" size="14px" />
        </StyledLink>
      </ShadowBox>
    </Wrapper>
  );
};

const StyledLink = styled(Link, {
  shouldForwardProp: isPropValid,
})<{theme: any; disabled: boolean; isLast: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.gray3)};
  font-size: ${p => p.theme.fontSizeMedium};
  text-align: center;
  padding: ${space(0.5)} ${space(1.5)};
  ${p => (p.isLast ? '' : `border-right: 1px solid ${p.theme.borderDark};`)}
  ${p => (p.disabled ? 'pointer-events: none;' : '')}

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    flex-grow: 1;
  }
`;

const Wrapper = styled('div')`
  display: flex;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: 100%;
  }
`;

const ShadowBox = styled('div')`
  display: flex;
  background: ${p => p.theme.offWhite};
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(3)};
  box-shadow: 3px 3px 0 ${p => p.theme.offWhite}, 3px 3px 0 1px ${p => p.theme.borderDark},
    7px 7px ${p => p.theme.offWhite}, 7px 7px 0 1px ${p => p.theme.borderDark};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: 100%;
  }
`;

export default ModalPagination;
