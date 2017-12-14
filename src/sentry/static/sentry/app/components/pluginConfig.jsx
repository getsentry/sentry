import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingIndicator from '../components/loadingIndicator';
import plugins from '../plugins';
import {t} from '../locale';

const PluginConfig = React.createClass({
  propTypes: {
    organization: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    data: PropTypes.object.isRequired,
    onDisablePlugin: PropTypes.func,
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      onDisablePlugin: () => {
        window.location.reload();
      },
    };
  },

  getInitialState() {
    return {
      loading: !plugins.isLoaded(this.props.data),
      testResults: '',
    };
  },

  componentWillMount() {
    this.loadPlugin(this.props.data);
  },

  componentWillReceiveProps(nextProps) {
    this.loadPlugin(nextProps.data);
  },

  shouldComponentUpdate(nextProps, nextState) {
    return (
      !_.isEqual(nextState, this.state) || !_.isEqual(nextProps.data, this.props.data)
    );
  },

  loadPlugin(data) {
    this.setState(
      {
        loading: true,
      },
      () => {
        plugins.load(data, () => {
          this.setState({loading: false});
        });
      }
    );
  },

  getPluginEndpoint() {
    let {organization, project, data} = this.props;
    return `/projects/${organization.slug}/${project.slug}/plugins/${data.id}/`;
  },

  disablePlugin() {
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(this.getPluginEndpoint(), {
      method: 'DELETE',
      success: () => {
        this.props.onDisablePlugin();
        IndicatorStore.remove(loadingIndicator);
      },
      error: error => {
        IndicatorStore.add(t('Unable to disable plugin. Please try again.'), 'error');
      },
    });
  },

  testPlugin() {
    let loadingIndicator = IndicatorStore.add(t('Sending test..'));
    this.api.request(this.getPluginEndpoint(), {
      method: 'POST',
      data: {
        test: true,
      },
      success: data => {
        this.setState({testResults: JSON.stringify(data.detail)});
        IndicatorStore.remove(loadingIndicator);
        IndicatorStore.add(t('Test Complete!'), 'success');
      },
      error: error => {
        IndicatorStore.add(
          t('An unexpected error occurred while testing your plugin. Please try again.'),
          'error'
        );
      },
    });
  },

  createMarkup() {
    return {__html: this.props.data.doc};
  },

  render() {
    let data = this.props.data;

    return (
      <div className={`box ref-plugin-config-${data.id}`}>
        <div className="box-header">
          {data.canDisable &&
            data.enabled && (
              <div className="pull-right">
                {data.isTestable && (
                  <a onClick={this.testPlugin} className="btn btn-sm btn-default">
                    {t('Test Plugin')}
                  </a>
                )}
                <a className="btn btn-sm btn-default" onClick={this.disablePlugin}>
                  {t('Disable')}
                </a>
              </div>
            )}
          <h3>{data.name}</h3>
        </div>
        <div className="box-content with-padding">
          {data.status === 'beta' ? (
            <div className="alert alert-block alert-warning">
              <strong>
                Note: This plugin is considered beta and may change in the future.
              </strong>
            </div>
          ) : null}
          {this.state.testResults != '' ? (
            <div className="alert alert-block alert-warning">
              <strong>Test Results: </strong>
              <p>{this.state.testResults}</p>
            </div>
          ) : null}
          <div dangerouslySetInnerHTML={this.createMarkup()} />
          {this.state.loading ? (
            <LoadingIndicator />
          ) : (
            plugins.get(data).renderSettings({
              organization: this.props.organization,
              project: this.props.project,
            })
          )}
        </div>
      </div>
    );
  },
});

export default PluginConfig;
