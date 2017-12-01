import React from 'react';
import AsyncView from './asyncView';
import {t} from '../locale';
import ExternalLink from '../components/externalLink';
import LinkWithConfirmation from '../components/linkWithConfirmation';

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

  renderBody() {
    return (
      <div>
        <h2>{t('Tags')}</h2>
        <p>
          Each event in Sentry may be annotated with various tags (key and value pairs).
          Learn how to{' '}
          <ExternalLink href="https://docs.sentry.io/hosted/learn/context/">
            add custom tags
          </ExternalLink>
          .
        </p>

        <div className="panel panel-default">
          <table className="table">
            <thead>
              <tr>
                <th>Tags</th>
                <th style={{width: 20}} />
              </tr>
            </thead>
            <tbody>
              {this.state.tags.map(({key, name}, idx) => {
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
                      <LinkWithConfirmation
                        className="btn btn-sm btn-default"
                        title={'Remove tag?'}
                        message={'Are you sure you want to remove this tag?'}
                        onConfirm={() => this.onDelete(key, idx)}
                      >
                        <span className="icon icon-trash" />
                      </LinkWithConfirmation>
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
