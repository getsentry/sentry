import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import DateTime from '../components/dateTime';
import FileSize from '../components/fileSize';
import {t} from '../locale';

const ProjectDebugSymbols = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      debugSymbols: [],
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/files/dsyms/`, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          debugSymbols: data,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  renderDebugTable() {
    let body;

    if (this.state.loading)
      body = this.renderLoading();
    else if (this.state.error)
      body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.debugSymbols.length > 0)
      body = this.renderResults();
    else
      body = this.renderEmpty();

    return body;
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('There are no debug symbols for this project.')}</p>
      </div>
    );
  },

  renderResults() {
    return (
      <table className="table">
        <thead>
          <tr>
            <th>{t('UUID')}</th>
            <th>{t('Object Name')}</th>
            <th>{t('Type')}</th>
            <th>{t('Upload Date')}</th>
            <th>{t('Size')}</th>
          </tr>
        </thead>
        <tbody>
          {this.state.debugSymbols.map((item, idx) => {
            return (
              <tr key={idx}>
                <td>{item.uuid}</td>
                <td>{item.objectName}</td>
                <td>{item.cpuName} ({item.symbolType})</td>
                <td><DateTime date={item.dateCreated}/></td>
                <td><FileSize bytes={item.size}/></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  },

  render() {
    return (
      <div>
        <h1>{t('Debug Symbols')}</h1>
        <p>{t(`
          Here you can find uploaded debug information (for instance debug
          symbol files).  This is used to convert addresses from crash dumps
          into function names and locations.  For JavaScript debug support
          look at releases instead.
        `)}</p>
        {this.renderDebugTable()}
      </div>
    );
  }
});

export default ProjectDebugSymbols;
