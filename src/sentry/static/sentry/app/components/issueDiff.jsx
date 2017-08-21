import React, {PropTypes} from 'react';
import classNames from 'classnames';

import ApiMixin from '../mixins/apiMixin';
import LoadingIndicator from './loadingIndicator';
import rawStacktraceContent from './events/interfaces/rawStacktraceContent';

import '../../less/components/issueDiff.less';
const IssueDiff = React.createClass({
  propTypes: {
    baseId: PropTypes.string,
    targetId: PropTypes.string
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {};
  },

  getInitialState() {
    return {
      loading: true,
      baseEvent: {},
      targetEvent: {},
      Diff: null
    };
  },

  componentDidMount() {
    let {baseId, targetId} = this.props;
    Promise.all([
      import('react-diff'),
      this.fetchData(baseId),
      this.fetchData(targetId)
    ]).then(([Diff, baseEvent, targetEvent]) => {
      this.setState({
        Diff,
        baseEvent: this.getException(baseEvent),
        targetEvent: this.getException(targetEvent),
        loading: false
      });
    });
  },

  getException(event) {
    if (!event || !event.entries) return '';

    const exc = event.entries.find(({type}) => type === 'exception');

    if (!exc || !exc.data) return '';

    return exc.data.values
      .map(value =>
        rawStacktraceContent(value.stacktrace, event.platform, value).split('\n')
      )
      .reduce((acc, value) => {
        return acc.concat(value);
      }, []);
  },

  getEndpoint(id) {
    return `/issues/${id}/events/latest/`;
  },

  fetchData(id) {
    return new Promise((resolve, reject) => {
      this.api.request(this.getEndpoint(id), {
        success: data => resolve(data),
        error: err => reject(err)
      });
    });
  },

  render() {
    let {className} = this.props;
    let cx = classNames('issue-diff', className);

    if (this.state.loading) {
      return <LoadingIndicator />;
    }
    return (
      <div className={cx}>
        {this.state.Diff &&
          this.state.baseEvent.map((value, i) => (
            <this.state.Diff
              key={i}
              inputA={value}
              inputB={this.state.targetEvent[i] || ''}
              type="sentences"
            />
          ))}
      </div>
    );
  }
});

export default IssueDiff;
