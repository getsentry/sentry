import React from 'react';

import LoadingIndicator from '../components/loadingIndicator';
import LoadingError from '../components/loadingError';

import ApiMixin from '../mixins/apiMixin';

import {t} from '../locale';

const GroupTombstones = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      tombstones: []
    };
  },

  componentDidMount() {
    let {orgId, projectId} = this.props.params;

    let path = `/projects/${orgId}/${projectId}/tombstone/`;
    this.api.request(path, {
      method: 'GET',
      data: this.props.location.query,
      success: (data, _, jqXHR) => {
        this.setState({
          tombstones: data,
          loading: false
        });
      },
      error: () => {
        this.setState({
          error: true
        });
      }
    });
  },

  renderEmpty() {
    return <div className="box empty">{t('None')}</div>;
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;

    if (this.state.error) return <LoadingError />;

    let {tombstones} = this.state;
    return (
      <div>
        <div className="row" style={{paddingTop: 10}}>
          <div className="col-sm-8">
            <h5>{t('Groups Marked as Discarded')}</h5>
            {tombstones.length
              ? <ul className="group-list">
                  {tombstones.map(data => {
                    return (
                      <li key={data.id} className={data.level}>
                        <div className="event-details">
                          <span className="error-level truncate" title={data.level} />
                          <h3 className="truncate">
                            <span style={{marginRight: 10}}>{data.type}</span>
                            <em>{data.culprit}</em><br />
                          </h3>
                          <div className="event-extra">
                            <div className="event-message truncate">
                              <span className="message">{data.message}</span>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              : this.renderEmpty()}
          </div>
        </div>
      </div>
    );
  }
});

export default GroupTombstones;
