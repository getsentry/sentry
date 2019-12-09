import React from 'react';
import styled from 'react-emotion';
import SentryTypes from 'app/sentryTypes';
import SearchBar from 'app/components/searchBar';

import {t} from 'app/locale';
import {Panel} from 'app/components/panels';
import space from 'app/styles/space';

import {SentryTransactionEvent} from './types';
import TraceView from './traceView';

type PropType = {
  event: SentryTransactionEvent;
};

type State = {
  searchQuery: string | undefined;
};

class SpansInterface extends React.Component<PropType, State> {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
  };

  state: State = {
    searchQuery: undefined,
  };

  handleSpanFilter = (searchQuery: string) => {
    this.setState({
      searchQuery: searchQuery || undefined,
    });
  };

  render() {
    const {event} = this.props;

    return (
      <div>
        <StyledSearchBar
          defaultQuery=""
          query={this.state.searchQuery || ''}
          placeholder={t('Search for spans')}
          onSearch={this.handleSpanFilter}
        />
        <Panel>
          <TraceView event={event} searchQuery={this.state.searchQuery} />
        </Panel>
      </div>
    );
  }
}

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(1)};
`;

export default SpansInterface;
