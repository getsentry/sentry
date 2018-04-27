import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import styled, {css} from 'react-emotion';

import ApiMixin from 'app/mixins/apiMixin';
import LoadingIndicator from 'app/components/loadingIndicator';
import rawStacktraceContent from 'app/components/events/interfaces/rawStacktraceContent';

const getLoadingStyle = p =>
  (p.loading &&
    css`
      background-color: white;
      justify-content: center;
    `) ||
  '';

const IssueDiffWrapper = styled.div`
  background-color: #f7f8f9;
  overflow: auto;
  padding: 10px;
  flex: 1;
  display: flex;
  flex-direction: column;

  ${getLoadingStyle};
`;

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
    let {baseIssueId, targetIssueId, baseEventId, targetEventId} = this.props;

    // Fetch component and event data
    Promise.all([
      import(/* webpackChunkName: "splitDiff" */ './splitDiff'),
      this.fetchData(baseIssueId, baseEventId),
      this.fetchData(targetIssueId, targetEventId),
    ]).then(([{default: SplitDiffAsync}, baseEvent, targetEvent]) => {
      this.setState({
        SplitDiffAsync,
        baseEvent: this.getException(baseEvent),
        targetEvent: this.getException(targetEvent),
        loading: false,
      });
    });
  }

  getException(event) {
    if (!event || !event.entries) return [];

    // TODO(billyvg): This only accounts for the first exception, will need navigation to be able to
    // diff multiple exceptions
    //
    // See: https://github.com/getsentry/sentry/issues/6055
    const exc = event.entries.find(({type}) => type === 'exception');

    if (!exc || !exc.data) return [];

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
    return new Promise((resolve, reject) => {
      this.props.api.request(this.getEndpoint(issueId, eventId), {
        success: data => resolve(data),
        error: err => reject(err),
      });
    });
  }

  render() {
    let DiffComponent = this.state.SplitDiffAsync;
    let diffReady = !this.state.loading && !!DiffComponent;

    return (
      <IssueDiffWrapper loading={this.state.loading}>
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
      </IssueDiffWrapper>
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
