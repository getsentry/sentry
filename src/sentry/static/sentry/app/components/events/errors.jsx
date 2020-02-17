import React from 'react';
import styled from '@emotion/styled';
import uniqWith from 'lodash/uniqWith';
import isEqual from 'lodash/isEqual';

import EventErrorItem from 'app/components/events/errorItem';
import SentryTypes from 'app/sentryTypes';
import {IconWarning} from 'app/icons';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';

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

  uniqueErrors = errors => {
    return uniqWith(errors, isEqual);
  };

  render() {
    const eventErrors = this.props.event.errors;
    // XXX: uniqueErrors is not performant with large datasets
    const errors =
      eventErrors.length > MAX_ERRORS ? eventErrors : this.uniqueErrors(eventErrors);
    const numErrors = errors.length;
    const isOpen = this.state.isOpen;
    return (
      <Section>
        <Summary>
          <span>
            <StyledIconWarning />
            {tn(
              'There was %s error encountered while processing this event',
              'There were %s errors encountered while processing this event',
              numErrors
            )}
          </span>
          <a data-test-id="event-error-toggle" onClick={this.toggle}>
            {isOpen ? t('Hide') : t('Show')}
          </a>
        </Summary>
        <ErrorList
          data-test-id="event-error-details"
          style={{display: isOpen ? 'block' : 'none'}}
        >
          {errors.map((error, errorIdx) => {
            return <EventErrorItem key={errorIdx} error={error} />;
          })}
        </ErrorList>
      </Section>
    );
  }
}

// TODO(theme) don't use a custom pink
const customPink = '#e7c0bc';

const Section = styled('div')`
  border-top: 1px solid ${customPink};
  border-bottom: 1px solid ${customPink};
  background: ${p => p.theme.redLightest};
  margin-top: -1px;
  padding: ${space(2)} ${space(4)} 1px 40px;
  font-size: ${p => p.theme.fontSizeMedium};

  a {
    font-weight: bold;
    color: ${p => p.theme.gray3};
    &:hover {
      color: ${p => p.theme.gray4};
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
  margin-right: ${space(1)};
  color: ${p => p.theme.red};
`;

const Summary = styled('p')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(1.5)};

  & > span {
    display: flex;
    align-items: center;
  }
`;

const ErrorList = styled('ul')`
  border-top: 1px solid ${customPink};
  margin: ${space(1)} 0 0;
  padding: ${space(1)} 0 ${space(1)} ${space(3)};

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
