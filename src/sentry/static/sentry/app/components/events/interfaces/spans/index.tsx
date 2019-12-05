import React from 'react';
import SentryTypes from 'app/sentryTypes';
import SearchBar from 'app/components/searchBar';

import {t} from 'app/locale';
import {Panel} from 'app/components/panels';

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
        <SearchBar
          defaultQuery=""
          query={this.state.searchQuery || ''}
          placeholder={t('Filter on spans')}
          onSearch={this.handleSpanFilter}
        />
        <br />
        <Panel>
          <TraceView event={event} searchQuery={this.state.searchQuery} />
        </Panel>
      </div>
    );
  }
}

export default SpansInterface;
