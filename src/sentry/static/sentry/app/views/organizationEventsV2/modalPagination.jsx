import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import isPropValid from '@emotion/is-prop-valid';
import {omit} from 'lodash';

import {t} from 'app/locale';
import Link from 'app/components/links/link';
import SentryTypes from 'app/sentryTypes';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

const ModalPagination = props => {
  const {location, event} = props;

  // Remove the groupSlug and eventSlug keys as we need to create new ones
  const query = omit(location.query, ['groupSlug', 'eventSlug']);
  const previousEventUrl = event.previousEventID
    ? {
        pathname: location.pathname,
        query: {
          ...query,
          groupSlug: `${event.projectSlug}:${event.groupID}:${event.previousEventID}`,
        },
      }
    : null;
  const nextEventUrl = event.nextEventID
    ? {
        pathname: location.pathname,
        query: {
          ...query,
          groupSlug: `${event.projectSlug}:${event.groupID}:${event.nextEventID}`,
        },
      }
    : null;
  const newestUrl = {
    pathname: location.pathname,
    query: {
      ...query,
      groupSlug: `${event.projectSlug}:${event.groupID}:latest`,
    },
  };
  const oldestUrl = {
    pathname: location.pathname,
    query: {
      ...query,
      groupSlug: `${event.projectSlug}:${event.groupID}:oldest`,
    },
  };

  return (
    <Wrapper>
      <ShadowBox>
        <StyledLink to={oldestUrl} disabled={previousEventUrl === null}>
          <InlineSvg src="icon-prev" size="14px" />
        </StyledLink>
        <StyledLink to={previousEventUrl} disabled={previousEventUrl === null}>
          {t('Older Event')}
        </StyledLink>
        <StyledLink to={nextEventUrl} disabled={nextEventUrl === null}>
          {t('Newer Event')}
        </StyledLink>
        <StyledLink to={newestUrl} disabled={nextEventUrl === null} isLast>
          <InlineSvg src="icon-next" size="14px" />
        </StyledLink>
      </ShadowBox>
    </Wrapper>
  );
};
ModalPagination.propTypes = {
  location: PropTypes.object.isRequired,
  event: SentryTypes.Event.isRequired,
};

const StyledLink = styled(Link, {shouldForwardProp: isPropValid})`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.gray3)};
  font-size: ${p => p.fontSizeMedium};
  text-align: center;
  padding: ${space(0.5)} ${space(1.5)};
  ${p => (p.isLast ? '' : `border-right: 1px solid ${p.theme.borderDark};`)}
  ${p => (p.disabled ? 'pointer-events: none;' : '')}

  @media(max-width: ${theme.breakpoints[0]}) {
    flex-grow: 1;
  }
`;

const Wrapper = styled('div')`
  display: flex;

  @media (max-width: ${theme.breakpoints[0]}) {
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

  @media (max-width: ${theme.breakpoints[0]}) {
    width: 100%;
  }
`;

export default ModalPagination;
