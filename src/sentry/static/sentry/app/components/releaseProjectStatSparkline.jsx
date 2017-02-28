import React from 'react';
import LoadingIndicator from '../components/loadingIndicator';
import LoadingError from '../components/loadingError';

import {Sparklines, SparklinesLine} from 'react-sparklines';

import ApiMixin from '../mixins/apiMixin';

const releaseProjectStatSparkline = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string,
    projectId: React.PropTypes.string,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      stats: [],
    };
  },

  componentDidMount() {
    let {orgId, projectId} = this.props;
    let path = `/projects/${orgId}/${projectId}/stats/`;
    this.api.request(path, {
      method: 'GET',
      data: 'stat=received',
      success: (data, _, jqXHR) => {
        this.setState({
          stats: data,
          loading: false,
          error: false,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      }
    });
  },

  render() {
    let values = this.state.stats.map(tuple => tuple[1]);
    if (this.state.loading)
      return <LoadingIndicator/>;

    if (this.state.error)
      return <LoadingError/>;
    return (
      <Sparklines data={values} width={100} height={32}>
        <SparklinesLine style={{stroke: '#8f85d4', fill: 'none', strokeWidth: 3}}/>
      </Sparklines>
    );
  }
});

export default releaseProjectStatSparkline;
