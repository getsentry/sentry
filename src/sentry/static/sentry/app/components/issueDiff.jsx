import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled, {css} from 'react-emotion';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import LoadingIndicator from 'app/components/loadingIndicator';
import rawStacktraceContent from 'app/components/events/interfaces/rawStacktraceContent';

class IssueDiff extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    baseIssueId: PropTypes.string.isRequired,
    targetIssueId: PropTypes.string.isRequired,
    baseEventId: PropTypes.string.isRequired,
    targetEventId: PropTypes.string.isRequired,
  };

  static defaultProps = {
    baseEventId: 'latest',
    targetEventId: 'latest',
  };

  constructor(...args) {
    super(...args);
    this.state = {
      loading: true,
      baseEvent: {},
      targetEvent: {},

      // `SplitDiffAsync` is an async-loaded component
      // This will eventually contain a reference to the exported component from `./splitDiff`
      SplitDiffAsync: null,
    };
  }

  componentDidMount() {
    const {baseIssueId, targetIssueId, baseEventId, targetEventId} = this.props;

    // Fetch component and event data
    Promise.all([
      import(/* webpackChunkName: "splitDiff" */ './splitDiff'),
      this.fetchData(baseIssueId, baseEventId),
      this.fetchData(targetIssueId, targetEventId),
    ])
      .then(([{default: SplitDiffAsync}, baseEvent, targetEvent]) => {
        this.setState({
          SplitDiffAsync,
          baseEvent: this.getException(baseEvent),
          targetEvent: this.getException(targetEvent),
          loading: false,
        });
      })
      .catch(() => {
        addErrorMessage(t('Error loading events'));
      });
  }

  getException(event) {
    if (!event || !event.entries) {
      return [];
    }

    // TODO(billyvg): This only accounts for the first exception, will need navigation to be able to
    // diff multiple exceptions
    //
    // See: https://github.com/getsentry/sentry/issues/6055
    const exc = event.entries.find(({type}) => type === 'exception');

    if (!exc) {
      // Look for a message if not an exception
      const msg = event.entries.find(({type}) => type === 'message');
      if (!msg) {
        return [];
      }

      return msg.data && msg.data.message && [msg.data.message];
    }

    if (!exc.data) {
      return [];
    }

    return exc.data.values
      .filter(value => !!value.stacktrace)
      .map(value => rawStacktraceContent(value.stacktrace, event.platform, value))
      .reduce((acc, value) => {
        return acc.concat(value);
      }, []);
  }

  getEndpoint(issueId, eventId) {
    if (eventId !== 'latest') {
      return `/events/${eventId}/`;
    }

    return `/issues/${issueId}/events/${eventId}/`;
  }

  fetchData(issueId, eventId) {
    return this.props.api.requestPromise(this.getEndpoint(issueId, eventId));
  }

  render() {
    const {className} = this.props;
    const DiffComponent = this.state.SplitDiffAsync;
    const diffReady = !this.state.loading && !!DiffComponent;

    return (
      <StyledIssueDiff className={className} loading={this.state.loading}>
        {this.state.loading && <LoadingIndicator />}
        {diffReady &&
          this.state.baseEvent.map((value, i) => (
            <DiffComponent
              key={i}
              base={value}
              target={this.state.targetEvent[i] || ''}
              type="words"
            />
          ))}
      </StyledIssueDiff>
    );
  }
}

const IssueDiffContainer = createReactClass({
  displayName: 'IssueDiffContainer',
  mixins: [ApiMixin],
  render() {
    return <IssueDiff {...this.props} api={this.api} />;
  },
});

export default IssueDiffContainer;
export {IssueDiff};

const getLoadingStyle = p =>
  (p.loading &&
    css`
      background-color: white;
      justify-content: center;
    `) ||
  '';

const StyledIssueDiff = styled('div')`
  background-color: #f7f8f9;
  overflow: auto;
  padding: 10px;
  flex: 1;
  display: flex;
  flex-direction: column;

  ${getLoadingStyle};
`;
