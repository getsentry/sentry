import type {Client} from 'sentry/api';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {IconFile} from 'sentry/icons/iconFile';
import ConfigStore from 'sentry/stores/configStore';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';

import DetailsPage from 'admin/components/detailsPage';

type Props = DeprecatedAsyncComponent['props'] &
  RouteComponentProps<
    {artifactKind: string; fileName: string; regionName: string; relocationUuid: string},
    unknown
  > & {
    api: Client;
  };

type State = DeprecatedAsyncComponent['state'] & {
  data: any;
};

class RelocationDetails extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const region = ConfigStore.get('regions').find(
      (r: any) => r.name === this.props.params.regionName
    );
    return [
      [
        'data',
        `/relocations/${this.props.params.relocationUuid}/artifacts/${this.props.params.artifactKind}/${this.props.params.fileName}`,
        {
          host: region ? region.url : '',
        },
      ],
    ];
  }

  componentDidMount() {
    super.componentDidMount();
    this.setState({
      data: {contents: ''},
    });
  }

  onRequestSuccess = ({stateKey, data}: any) => {
    if (stateKey === 'data') {
      this.setState({
        data,
      });
    }
  };

  renderBody() {
    return (
      <DetailsPage
        rootName="Relocation"
        name={`${this.props.params.artifactKind}/${this.props.params.fileName}`}
        crumbs={[this.props.params.relocationUuid]}
        sections={[
          {
            content: (
              <CodeSnippet
                dark
                filename={this.props.params.fileName}
                hideCopyButton
                icon={<IconFile />}
              >
                {this.state.data.contents}
              </CodeSnippet>
            ),
          },
        ]}
      />
    );
  }
}

export default RelocationDetails;
