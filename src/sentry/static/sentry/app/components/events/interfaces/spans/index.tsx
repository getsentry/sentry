import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import SearchBar from 'app/components/searchBar';
import SentryTypes from 'app/sentryTypes';
import {Panel} from 'app/components/panels';
import space from 'app/styles/space';
import EventView from 'app/utils/discover/eventView';

import {SentryTransactionEvent, ParsedTraceType} from './types';
import {parseTrace} from './utils';
import TraceView from './traceView';

type Props = {
  orgId: string;
  event: SentryTransactionEvent;
  eventView: EventView;
};

type State = {
  parsedTrace: ParsedTraceType;
  searchQuery: string | undefined;
};

class SpansInterface extends React.Component<Props, State> {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    orgId: PropTypes.string.isRequired,
  };

  state: State = {
    searchQuery: undefined,
    parsedTrace: parseTrace(this.props.event),
  };

  static getDerivedStateFromProps(props: Props, state: State): State {
    return {
      ...state,
      parsedTrace: parseTrace(props.event),
    };
  }

  handleSpanFilter = (searchQuery: string) => {
    this.setState({
      searchQuery: searchQuery || undefined,
    });
  };

  render() {
    const {event, orgId, eventView} = this.props;

    return (
      <div>
        <StyledSearchBar
          defaultQuery=""
          query={this.state.searchQuery || ''}
          placeholder={t('Search for spans')}
          onSearch={this.handleSpanFilter}
        />
        <Panel>
          <TraceView
            event={event}
            searchQuery={this.state.searchQuery}
            orgId={orgId}
            eventView={eventView}
            parsedTrace={this.state.parsedTrace}
          />
        </Panel>
      </div>
    );
  }
}

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(1)};
`;

export default SpansInterface;
