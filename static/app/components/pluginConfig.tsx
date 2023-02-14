import {Component} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import plugins from 'sentry/plugins';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import {Organization, Plugin, Project} from 'sentry/types';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  data: Plugin;
  onDisablePlugin: (data: Plugin) => void;
  organization: Organization;
  project: Project;
  enabled?: boolean;
};

type State = {
  testResults: string;
  loading?: boolean;
};

class PluginConfig extends Component<Props, State> {
  static defaultProps = {
    onDisablePlugin: () => {},
  };

  state: State = {
    loading: !plugins.isLoaded(this.props.data),
    testResults: '',
  };

  componentDidMount() {
    this.loadPlugin(this.props.data);
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    this.loadPlugin(nextProps.data);
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    return !isEqual(nextState, this.state) || !isEqual(nextProps.data, this.props.data);
  }

  loadPlugin(data: Plugin) {
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
  }

  getPluginEndpoint() {
    const {organization, project, data} = this.props;
    return `/projects/${organization.slug}/${project.slug}/plugins/${data.id}/`;
  }

  handleDisablePlugin = () => {
    this.props.onDisablePlugin(this.props.data);
  };

  handleTestPlugin = async () => {
    this.setState({testResults: ''});
    addLoadingMessage(t('Sending test...'));

    try {
      const data = await this.props.api.requestPromise(this.getPluginEndpoint(), {
        method: 'POST',
        data: {
          test: true,
        },
      });

      this.setState({testResults: JSON.stringify(data.detail)});
      addSuccessMessage(t('Test Complete!'));
    } catch (_err) {
      addErrorMessage(
        t('An unexpected error occurred while testing your plugin. Please try again.')
      );
    }
  };

  createMarkup() {
    return {__html: this.props.data.doc};
  }

  render() {
    const {data} = this.props;
    // If passed via props, use that value instead of from `data`
    const enabled =
      typeof this.props.enabled !== 'undefined' ? this.props.enabled : data.enabled;

    return (
      <Panel
        className={`plugin-config ref-plugin-config-${data.id}`}
        data-test-id="plugin-config"
      >
        <PanelHeader hasButtons>
          <PluginName>
            <StyledPluginIcon pluginId={data.id} />
            <span>{data.name}</span>
          </PluginName>

          {data.canDisable && enabled && (
            <Actions>
              {data.isTestable && (
                <TestPluginButton onClick={this.handleTestPlugin} size="sm">
                  {t('Test Plugin')}
                </TestPluginButton>
              )}
              <Button size="sm" onClick={this.handleDisablePlugin}>
                {t('Disable')}
              </Button>
            </Actions>
          )}
        </PanelHeader>

        {data.status === 'beta' && (
          <PanelAlert type="warning">
            {t('This plugin is considered beta and may change in the future.')}
          </PanelAlert>
        )}

        {this.state.testResults !== '' && (
          <PanelAlert type="info">
            <strong>Test Results</strong>
            <div>{this.state.testResults}</div>
          </PanelAlert>
        )}

        <StyledPanelBody>
          <div dangerouslySetInnerHTML={this.createMarkup()} />
          {this.state.loading ? (
            <LoadingIndicator />
          ) : (
            plugins.get(data).renderSettings({
              organization: this.props.organization,
              project: this.props.project,
            })
          )}
        </StyledPanelBody>
      </Panel>
    );
  }
}

export {PluginConfig};
export default withApi(PluginConfig);

const PluginName = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;
`;

const StyledPluginIcon = styled(PluginIcon)`
  margin-right: ${space(1)};
`;

const Actions = styled('div')`
  display: flex;
`;
const TestPluginButton = styled(Button)`
  margin-right: ${space(1)};
`;

const StyledPanelBody = styled(PanelBody)`
  padding: ${space(2)};
  padding-bottom: 0;
`;
