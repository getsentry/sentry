import React, {PropTypes} from 'react';
import classNames from 'classnames';

import ApiMixin from '../mixins/apiMixin';
import LoadingIndicator from './loadingIndicator';
import rawStacktraceContent from './events/interfaces/rawStacktraceContent';

import '../../less/components/issueDiff.less';

const IssueDiff = React.createClass({
  propTypes: {
    baseIssueId: PropTypes.string.isRequired,
    targetIssueId: PropTypes.string.isRequired,
    baseEventId: PropTypes.string.isRequired,
    targetEventId: PropTypes.string.isRequired
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      baseEventId: 'latest',
      targetEventId: 'latest'
    };
  },

  getInitialState() {
    return {
      loading: true,
      baseEvent: {},
      targetEvent: {},

      // `SplitDiffAsync` is an async-loaded component
      // This will eventually contain a reference to the exported component from `./splitDiff`
      SplitDiffAsync: null
    };
  },

  componentDidMount() {
    let {baseIssueId, targetIssueId, baseEventId, targetEventId} = this.props;

    // Fetch component and event data
    Promise.all([
      import('./splitDiff'),
      this.fetchData(baseIssueId, baseEventId),
      this.fetchData(targetIssueId, targetEventId)
    ]).then(([{default: SplitDiffAsync}, baseEvent, targetEvent]) => {
      this.setState({
        SplitDiffAsync,
        baseEvent: this.getException(baseEvent),
        targetEvent: this.getException(targetEvent),
        loading: false
      });
    });
  },

  getException(event) {
    if (!event || !event.entries) return [];

    // TODO(billyvg): This only accounts for the first exception, will need navigation to be able to
    // diff multiple exceptions
    //
    // See: https://github.com/getsentry/sentry/issues/6055
    const exc = event.entries.find(({type}) => type === 'exception');

    if (!exc || !exc.data) return [];

    return exc.data.values
      .map(value => rawStacktraceContent(value.stacktrace, event.platform, value))
      .reduce((acc, value) => {
        return acc.concat(value);
      }, []);
  },

  getEndpoint(issueId, eventId) {
    return `/issues/${issueId}/events/${eventId}/`;
  },

  fetchData(issueId, eventId) {
    return new Promise((resolve, reject) => {
      this.api.request(this.getEndpoint(issueId, eventId), {
        success: data => resolve(data),
        error: err => reject(err)
      });
    });
  },

  render() {
    let {className} = this.props;
    let cx = classNames('issue-diff', className, {
      loading: this.state.loading
    });
    let DiffComponent = this.state.SplitDiffAsync;
    let diffReady = !this.state.loading && !!DiffComponent;

    return (
      <div className={cx}>
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
      </div>
    );
  }
});

export default IssueDiff;
