import React from 'react';

import ReleaseUserCommitList from '../components/releaseUserCommitList';
import LoadingIndicator from '../components/loadingIndicator';
import ApiMixin from '../mixins/apiMixin';


const UserReleaseActivity = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return ({
      releaseList: [],
      loading:true,
    });
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    let params = this.props.params;
    let path = `/organizations/${params.orgId}/users/${params.userId}/releases/`;
    this.api.request(path, {
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.setState({
          releaseList: data,
          loading: false,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },


  render() {
    let {releaseList} = this.state;
    if (this.state.loading) {
      return(<LoadingIndicator/>);
    }
    if (!releaseList.length) {
      return (<div>No release activity</div>);
    }
    return (
      <div>
      {releaseList.map(release=>{
          return (<ReleaseUserCommitList orgId={this.props.params.orgId} release={release} userId={this.props.params.userId}/>);
      })}
      </div>

    );
  }
});

export default UserReleaseActivity;