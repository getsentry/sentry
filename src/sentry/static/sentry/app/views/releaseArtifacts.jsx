import PropTypes from 'prop-types';
import React from 'react';
import {Flex} from 'grid-emotion';

import createReactClass from 'create-react-class';

import ApiMixin from '../mixins/apiMixin';
import OrganizationState from '../mixins/organizationState';
import Tooltip from '../components/tooltip';
import FileSize from '../components/fileSize';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import IndicatorStore from '../stores/indicatorStore';
import Pagination from '../components/pagination';
import LinkWithConfirmation from '../components/linkWithConfirmation';
import {t} from '../locale';
import {Panel, PanelHeader, PanelBody, PanelItem} from '../components/panels';
import EmptyStateWarning from '../components/emptyStateWarning';

const ReleaseArtifacts = createReactClass({
  displayName: 'ReleaseArtifacts',

  contextTypes: {
    release: PropTypes.object,
  },

  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      fileList: [],
      pageLinks: null,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  componentDidUpdate(prevProps) {
    if (this.props.location.search !== prevProps.location.search) {
      this.fetchData();
    }
  },

  getFilesEndpoint() {
    let params = this.props.params;
    return `/projects/${params.orgId}/${params.projectId}/releases/${encodeURIComponent(
      params.version
    )}/files/`;
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    this.api.request(this.getFilesEndpoint(), {
      method: 'GET',
      data: this.props.location.query,
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          fileList: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
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

  handleRemove(id) {
    let loadingIndicator = IndicatorStore.add(t('Removing artifact..'));

    this.api.request(this.getFilesEndpoint() + `${id}/`, {
      method: 'DELETE',
      success: () => {
        let fileList = this.state.fileList.filter(file => {
          return file.id !== id;
        });

        this.setState({
          fileList,
        });

        IndicatorStore.add(t('Artifact removed.'), 'success', {
          duration: 4000,
        });
      },
      error: () => {
        IndicatorStore.add(t('Unable to remove artifact. Please try again.'), 'error', {
          duration: 4000,
        });
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      },
    });
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;
    else if (this.state.fileList.length === 0)
      return (
        <Panel>
          <EmptyStateWarning>
            <p>{t('There are no artifacts uploaded for this release.')}</p>
          </EmptyStateWarning>
        </Panel>
      );

    let access = this.getAccess();

    // TODO(dcramer): files should allow you to download them
    return (
      <div>
        <Panel>
          <PanelHeader>
            <Flex flex="7">{t('Name')}</Flex>
            <Flex flex="2">{t('Distribution')}</Flex>
            <Flex flex="3">{t('Size')}</Flex>
          </PanelHeader>
          <PanelBody>
            {this.state.fileList.map(file => {
              return (
                <PanelItem key={file.id}>
                  <Flex flex="7" style={{wordWrap: 'break-word'}}>
                    <strong>{file.name || '(empty)'}</strong>
                  </Flex>
                  <Flex flex="2">
                    {file.dist || <span className="text-light">{t('None')}</span>}
                  </Flex>
                  <Flex flex="3" justify="space-between">
                    <FileSize bytes={file.size} />
                    <Flex align="center">
                      {access.has('project:write') ? (
                        <a
                          href={
                            this.api.baseUrl +
                            this.getFilesEndpoint() +
                            `${file.id}/?download=1`
                          }
                          className="btn btn-sm btn-default"
                        >
                          <span className="icon icon-open" />
                        </a>
                      ) : (
                        <Tooltip
                          title={t(
                            'You do not have the required permission to download this artifact.'
                          )}
                        >
                          <div className="btn btn-sm btn-default disabled">
                            <span className="icon icon-open" />
                          </div>
                        </Tooltip>
                      )}
                      <div style={{marginLeft: 5}}>
                        <LinkWithConfirmation
                          className="btn btn-sm btn-default"
                          title={t('Delete artifact')}
                          message={t('Are you sure you want to remove this artifact?')}
                          onConfirm={this.handleRemove.bind(this, file.id)}
                        >
                          <span className="icon icon-trash" />
                        </LinkWithConfirmation>
                      </div>
                    </Flex>
                  </Flex>
                </PanelItem>
              );
            })}
          </PanelBody>
        </Panel>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  },
});

export default ReleaseArtifacts;
