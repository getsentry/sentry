import React from 'react';
import styled from '@emotion/styled';
import uniqWith from 'lodash/uniqWith';
import isEqual from 'lodash/isEqual';

import EventErrorItem from 'app/components/events/errorItem';
import SentryTypes from 'app/sentryTypes';
import {IconWarning} from 'app/icons';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';

import {BannerContainer, BannerSummary} from './styles';

const MAX_ERRORS = 100;

class EventErrors extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
  };

  state = {
    isOpen: false,
  };

  shouldComponentUpdate(nextProps, nextState) {
    if (this.state.isOpen !== nextState.isOpen) {
      return true;
    }
    return this.props.event.id !== nextProps.event.id;
  }

  toggle = () => {
    this.setState({isOpen: !this.state.isOpen});
  };

  uniqueErrors = errors => uniqWith(errors, isEqual);

  render() {
    const eventErrors = this.props.event.errors;
    // XXX: uniqueErrors is not performant with large datasets
    const errors =
      eventErrors.length > MAX_ERRORS ? eventErrors : this.uniqueErrors(eventErrors);
    const numErrors = errors.length;
    const isOpen = this.state.isOpen;
    return (
      <StyledBanner priority="danger">
        <BannerSummary>
          <StyledIconWarning />
          <span>
            {tn(
              'There was %s error encountered while processing this event',
              'There were %s errors encountered while processing this event',
              numErrors
            )}
          </span>
          <a data-test-id="event-error-toggle" onClick={this.toggle}>
            {isOpen ? t('Hide') : t('Show')}
          </a>
        </BannerSummary>
        <ErrorList
          data-test-id="event-error-details"
          style={{display: isOpen ? 'block' : 'none'}}
        >
          {errors.map((error, errorIdx) => (
            <EventErrorItem key={errorIdx} error={error} />
          ))}
        </ErrorList>
      </StyledBanner>
    );
  }
}

const StyledBanner = styled(BannerContainer)`
  margin-top: -1px;

  a {
    font-weight: bold;
    color: ${p => p.theme.gray600};
    &:hover {
      color: ${p => p.theme.gray700};
    }
  }

  /*
  Remove border on adjacent context summary box.
  Once that component uses emotion this will be harder.
  */
  & + .context-summary {
    border-top: none;
  }
`;

const StyledIconWarning = styled(IconWarning)`
  color: ${p => p.theme.red};
`;

// TODO(theme) don't use a custom pink
const customPink = '#e7c0bc';

const ErrorList = styled('ul')`
  border-top: 1px solid ${customPink};
  margin: 0 ${space(3)} 0 ${space(4)};
  padding: ${space(1)} 0 ${space(0.5)} ${space(4)};

  li {
    margin-bottom: ${space(0.75)};
    word-break: break-word;
  }

  pre {
    background: #f9eded;
    color: #381618;
    margin: 5px 0 0;
  }
`;

export default EventErrors;
