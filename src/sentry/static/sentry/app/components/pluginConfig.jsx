import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import createReactClass from 'create-react-class';

import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import Button from 'app/components/buttons/button';
import IndicatorStore from 'app/stores/indicatorStore';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import PluginIcon from 'app/plugins/components/pluginIcon';
import plugins from 'app/plugins';

const PluginConfig = createReactClass({
  displayName: 'PluginConfig',

  propTypes: {
    organization: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    data: PropTypes.object.isRequired,
    onDisablePlugin: PropTypes.func,
    enabled: PropTypes.bool,
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      onDisablePlugin: () => {},
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
    this.props.onDisablePlugin(this.props.data);
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
    let {data} = this.props;
    // If passed via props, use that value instead of from `data`
    let enabled =
      typeof this.props.enabled !== 'undefined' ? this.props.enabled : data.enabled;

    return (
      <Panel className={`plugin-config ref-plugin-config-${data.id}`}>
        <PanelHeader hasButtons>
          <Flex align="center" flex="1">
            <Flex align="center" mr={1}>
              <PluginIcon pluginId={data.id} />
            </Flex>
            <span>{data.name}</span>
          </Flex>
          {data.canDisable &&
            enabled && (
              <Flex align="center">
                <Box mr={1}>
                  {data.isTestable && (
                    <Button onClick={this.testPlugin} size="small">
                      {t('Test Plugin')}
                    </Button>
                  )}
                </Box>
                <Box>
                  <Button size="small" onClick={this.disablePlugin}>
                    {t('Disable')}
                  </Button>
                </Box>
              </Flex>
            )}
        </PanelHeader>
        <PanelBody px={2} pt={2} flex wrap="wrap">
          {data.status === 'beta' ? (
            <div className="alert alert-block alert-warning">
              <strong>
                {t('Note: This plugin is considered beta and may change in the future.')}
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
        </PanelBody>
      </Panel>
    );
  },
});

export default PluginConfig;
