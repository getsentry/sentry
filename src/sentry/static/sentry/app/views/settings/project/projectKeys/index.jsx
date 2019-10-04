import {Box, Flex} from 'grid-emotion';
import {Link} from 'react-router';
import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  removeIndicator,
} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import ClippedBox from 'app/components/clippedBox';
import Confirm from 'app/components/confirm';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ExternalLink from 'app/components/links/externalLink';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import ProjectKeyCredentials from 'app/views/settings/project/projectKeys/projectKeyCredentials';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import recreateRoute from 'app/utils/recreateRoute';

class KeyRow extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    access: PropTypes.object.isRequired,
    onToggle: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
  };

  state = {
    loading: false,
    error: false,
  };

  handleRemove = () => {
    if (this.state.loading) {
      return;
    }

    const loadingIndicator = addLoadingMessage(t('Saving changes..'));
    const {orgId, projectId, data} = this.props;
    this.props.api.request(`/projects/${orgId}/${projectId}/keys/${data.id}/`, {
      method: 'DELETE',
      success: () => {
        this.props.onRemove();
        removeIndicator(loadingIndicator);
        addSuccessMessage(t('Revoked key'));
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
        removeIndicator(loadingIndicator);
        addErrorMessage(t('Unable to revoke key'));
      },
    });
  };

  handleUpdate = (params, cb) => {
    if (this.state.loading) {
      return;
    }
    const loadingIndicator = addLoadingMessage(t('Saving changes..'));
    const {orgId, projectId, data} = this.props;
    this.props.api.request(`/projects/${orgId}/${projectId}/keys/${data.id}/`, {
      method: 'PUT',
      data: params,
      success: d => {
        removeIndicator(loadingIndicator);
        cb(d);
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
        removeIndicator(loadingIndicator);
      },
    });
  };

  handleEnable = () => {
    this.handleUpdate(
      {
        isActive: true,
      },
      this.props.onToggle
    );
  };

  handleDisable = () => {
    this.handleUpdate(
      {
        isActive: false,
      },
      this.props.onToggle
    );
  };

  render() {
    const {access, data} = this.props;
    const editUrl = recreateRoute(`${data.id}/`, this.props);
    const controlActive = access.has('project:write') && !this.state.loading;

    const controls = [
      <Button key="edit" to={editUrl} size="small">
        {t('Configure')}
      </Button>,
      <Button
        key="toggle"
        size="small"
        onClick={data.isActive ? this.handleDisable : this.handleEnable}
        disabled={!controlActive}
      >
        {data.isActive ? t('Disable') : t('Enable')}
      </Button>,
      <Confirm
        key="remove"
        priority="danger"
        disabled={!controlActive}
        onConfirm={this.handleRemove}
        confirmText={t('Remove Key')}
        message={t(
          'Are you sure you want to remove this key? This action is irreversible.'
        )}
      >
        <Button size="small" disabled={!controlActive} icon="icon-trash" />
      </Confirm>,
    ];

    return (
      <ClientKeyItemPanel disabled={!data.isActive}>
        <PanelHeader hasButtons>
          <Box flex="1">
            <PanelHeaderLink to={editUrl}>{data.label}</PanelHeaderLink>
            {!data.isActive && (
              <small>
                {' '}
                <i className="icon icon-ban" /> {t('Disabled')}
              </small>
            )}
          </Box>
          <Flex align="center">
            {controls.map((c, n) => (
              <KeyControl key={n}> {c}</KeyControl>
            ))}
          </Flex>
        </PanelHeader>

        <ClippedBox clipHeight={300} defaultClipped btnText={t('Expand')}>
          <PanelBody>
            <ProjectKeyCredentials projectId={`${data.projectId}`} data={data} />
          </PanelBody>
        </ClippedBox>
      </ClientKeyItemPanel>
    );
  }
}

export default class ProjectKeys extends AsyncView {
  static propTypes = {
    routes: PropTypes.array.isRequired,
    params: PropTypes.object.isRequired,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  getTitle() {
    return t('Client Keys');
  }

  getEndpoints() {
    const {orgId, projectId} = this.props.params;
    return [['keyList', `/projects/${orgId}/${projectId}/keys/`]];
  }

  handleRemoveKey = data => {
    this.setState(state => {
      return {
        keyList: state.keyList.filter(key => {
          return key.id !== data.id;
        }),
      };
    });
  };

  handleToggleKey = (data, newData) => {
    this.setState(state => {
      const keyList = state.keyList;
      keyList.forEach(key => {
        if (key.id === data.id) {
          key.isActive = newData.isActive;
        }
      });
      return {keyList};
    });
  };

  handleCreateKey = () => {
    const {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/keys/`, {
      method: 'POST',
      success: data => {
        this.setState(state => {
          return {
            keyList: [...state.keyList, data],
          };
        });
        addSuccessMessage(t('Created a new key.'));
      },
      error: () => {
        addErrorMessage(t('Unable to create new key. Please try again.'));
      },
    });
  };

  renderEmpty() {
    return (
      <Panel>
        <EmptyMessage
          icon="icon-circle-exclamation"
          description={t('There are no keys active for this project.')}
        />
      </Panel>
    );
  }

  renderResults() {
    const {routes, params} = this.props;
    const {orgId, projectId} = params;
    const access = new Set(this.context.organization.access);

    return (
      <div>
        <div>
          {this.state.keyList.map(key => {
            return (
              <KeyRow
                api={this.api}
                routes={routes}
                params={params}
                access={access}
                key={key.id}
                orgId={orgId}
                projectId={`${projectId}`}
                data={key}
                onToggle={this.handleToggleKey.bind(this, key)}
                onRemove={this.handleRemoveKey.bind(this, key)}
              />
            );
          })}
        </div>
        <Pagination pageLinks={this.state.keyListPageLinks} />
      </div>
    );
  }

  renderBody() {
    const access = new Set(this.context.organization.access);
    const isEmpty = !this.state.keyList.length;

    return (
      <DocumentTitle title={t('Client Keys')}>
        <div className="ref-keys">
          <SettingsPageHeader
            title={t('Client Keys')}
            action={
              access.has('project:write') ? (
                <Button
                  onClick={this.handleCreateKey}
                  size="small"
                  priority="primary"
                  icon="icon-circle-add"
                >
                  {t('Generate New Key')}
                </Button>
              ) : null
            }
          />
          <TextBlock>
            {tct(
              `To send data to Sentry you will need to configure an SDK with a client key
            (usually referred to as the [code:SENTRY_DSN] value). For more
            information on integrating Sentry with your application take a look at our
            [link:documentation].`,
              {
                link: <ExternalLink href="https://docs.sentry.io/" />,
                code: <code />,
              }
            )}
          </TextBlock>

          {isEmpty ? this.renderEmpty() : this.renderResults()}
        </div>
      </DocumentTitle>
    );
  }
}

const ClientKeyItemPanel = styled(({disabled: _disabled, ...props}) => (
  <Panel {...props} />
))`
  ${p => (p.disabled ? 'opacity: 0.5;' : '')};

  .box-clippable {
    padding: 0;
    margin: 0;

    .clip-fade {
      padding-bottom: 20px;
    }
  }
`;

const PanelHeaderLink = styled(Link)`
  color: ${p => p.theme.gray3};
`;

const KeyControl = styled('span')`
  margin-left: 6px;
`;
