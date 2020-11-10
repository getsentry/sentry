import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import uniqWith from 'lodash/uniqWith';
import isEqual from 'lodash/isEqual';
import {css} from '@emotion/core';

import Button from 'app/components/button';
import EventErrorItem from 'app/components/events/errorItem';
import {Event} from 'app/types';
import {IconWarning} from 'app/icons';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

import {BannerContainer, BannerSummary} from './styles';

const MAX_ERRORS = 100;

type Props = {
  event: Event;
};

type State = {
  isOpen: boolean;
};

class EventErrors extends React.Component<Props, State> {
  static propTypes: any = {
    event: PropTypes.object.isRequired,
  };

  state: State = {
    isOpen: false,
  };

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    if (this.state.isOpen !== nextState.isOpen) {
      return true;
    }
    return this.props.event.id !== nextProps.event.id;
  }

  toggle = () => {
    this.setState(state => ({isOpen: !state.isOpen}));
  };

  uniqueErrors = (errors: any[]) => uniqWith(errors, isEqual);

  render() {
    const {event} = this.props;
    // XXX: uniqueErrors is not performant with large datasets
    const errors =
      event.errors.length > MAX_ERRORS ? event.errors : this.uniqueErrors(event.errors);

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
          <StyledButton
            data-test-id="event-error-toggle"
            priority="link"
            onClick={this.toggle}
          >
            {isOpen ? t('Hide') : t('Show')}
          </StyledButton>
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

const linkStyle = ({theme}: {theme: Theme}) => css`
  font-weight: bold;
  color: ${theme.gray600};
  :hover {
    color: ${theme.gray700};
  }
`;

const StyledButton = styled(Button)`
  ${linkStyle}
`;

const StyledBanner = styled(BannerContainer)`
  margin-top: -1px;
  a {
    ${linkStyle}
  }
`;

const StyledIconWarning = styled(IconWarning)`
  color: ${p => p.theme.red300};
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
    margin: ${space(0.5)} 0 0;
  }
`;

export default EventErrors;
