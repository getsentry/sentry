import React from 'react';

import {t} from '../locale';
import AsyncView from './asyncView';
import ExternalLink from '../components/externalLink';
import LinkWithConfirmation from '../components/linkWithConfirmation';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import TextBlock from './settings/components/text/textBlock';
import Tooltip from '../components/tooltip';

export default class ProjectTags extends AsyncView {
  getEndpoints() {
    let {projectId, orgId} = this.props.params;
    return [['tags', `/projects/${orgId}/${projectId}/tags/`]];
  }

  onDelete(key, idx) {
    let {projectId, orgId} = this.props.params;

    this.api.request(`/projects/${orgId}/${projectId}/tags/${key}/`, {
      method: 'DELETE',
      success: () => {
        let tags = this.state.tags.slice();
        tags.splice(idx, 1);
        this.setState({tags});
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  }

  renderLink(key, canDelete, idx) {
    return (
      <LinkWithConfirmation
        className={'btn btn-sm btn-default'}
        title={'Remove tag?'}
        message={'Are you sure you want to remove this tag?'}
        onConfirm={() => this.onDelete(key, idx)}
        disabled={!canDelete}
      >
        <span className="icon icon-trash" />
      </LinkWithConfirmation>
    );
  }

  renderBody() {
    return (
      <div>
        <SettingsPageHeader title={t('Tags')} />
        <TextBlock>
          Each event in Sentry may be annotated with various tags (key and value pairs).
          Learn how to{' '}
          <ExternalLink href="https://docs.sentry.io/hosted/learn/context/">
            add custom tags
          </ExternalLink>
          .
        </TextBlock>

        <div className="panel panel-default">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Tags')}</th>
                <th style={{width: 20}} />
              </tr>
            </thead>
            <tbody>
              {this.state.tags.map(({key, name, canDelete}, idx) => {
                return (
                  <tr key={key}>
                    <td>
                      <h5>
                        {name}
                        &nbsp;
                        <small>({key})</small>
                      </h5>
                    </td>
                    <td>
                      {canDelete ? (
                        this.renderLink(key, canDelete, idx)
                      ) : (
                        <Tooltip title={t('This tag cannot be deleted.')}>
                          <span>{this.renderLink(key, canDelete, idx)}</span>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}
