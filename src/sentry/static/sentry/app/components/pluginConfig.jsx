import React from 'react';
import AlertActions from '../actions/alertActions';
import ApiMixin from '../mixins/apiMixin';
import LoadingIndicator from '../components/loadingIndicator';
import plugins from '../plugins';
import {t} from '../locale';

const PluginConfig = React.createClass({
  propTypes: {
    organization: React.PropTypes.object.isRequired,
    project: React.PropTypes.object.isRequired,
    data: React.PropTypes.object.isRequired
  },

  mixins: [ApiMixin],

  componentWillMount() {
    this.setState({
      loading: true,
    }, () => {
      plugins.load(this.props.data, () => {
        this.setState({loading: false});
      });
    });
  },

  componentWillReceiveProps(nextProps) {
    this.setState({
      loading: true,
    }, () => {
      plugins.load(nextProps.data, () => {
        this.setState({loading: false});
      });
    });
  },

  getPluginEndpoint(data) {
    let org = this.props.organization;
    let project = this.props.project;
    return (
      `/projects/${org.slug}/${project.slug}/plugins/${data.id}/`
    );
  },

  disablePlugin(data) {
    this.api.request(this.getPluginEndpoint(data), {
      method: 'DELETE',
      success: () => {
        // When this whole page is a react view, this won't be necessary
        window.location.reload();
      },
      error: (error) => {
        AlertActions.addAlert({
          message: t('There was an error disabling the plugin'),
          type: 'error'
        });
      }
    });
  },

  render() {
    let data = this.props.data;

    return (
      <div className="box">
        <div className="box-header">
          {data.canDisable && data.enabled &&
            <button className="btn btn-sm btn-default pull-right"
                    onClick={this.disablePlugin.bind(this, data)}>{t('Disable')}</button>}
          <h3>{data.name}</h3>
        </div>
        <div className="box-content with-padding">
          {this.state.loading ?
            <LoadingIndicator />
          :
            plugins.get(data).renderSettings({
              organization: this.props.organization,
              project: this.props.project,
            })
          }
        </div>
      </div>
    );
  }
});

export default PluginConfig;
