import React from 'react';
import AsyncView from './asyncView';
import {t} from '../locale';
import ExternalLink from '../components/externalLink';
import Checkbox from '../components/checkbox';
import IndicatorStore from '../stores/indicatorStore';

export default class ProjectPlugins extends AsyncView {
  getTitle() {
    return 'Project Integration Settings';
  }

  getEndpoints() {
    let {projectId, orgId} = this.props.params;
    return [['plugins', `/projects/${orgId}/${projectId}/plugins/`]];
  }

  handleChange(pluginId, shouldEnable, idx) {
    let {projectId, orgId} = this.props.params;

    let method = shouldEnable ? 'POST' : 'DELETE';

    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

    this.api.request(`/projects/${orgId}/${projectId}/plugins/${pluginId}/`, {
      method,
      success: () => {
        let plugins = this.state.plugins.slice();
        plugins[idx].enabled = shouldEnable;
        this.setState({
          plugins,
        });
        IndicatorStore.addSuccess(
          t(`Plugin was ${shouldEnable ? 'enabled' : 'disabled'}`)
        );
      },
      error: () => {
        IndicatorStore.addError(t('An error occurred'));
      },
      complete: () => IndicatorStore.remove(loadingIndicator),
    });
  }

  renderBody() {
    let {projectId, orgId} = this.props.params;

    return (
      <div>
        <h2>{t('Integrations')}</h2>

        <div className="panel panel-default">
          <table className="table integrations simple">
            <thead>
              <tr>
                <th colSpan={2}>{t('Integration')}</th>
                <th className="align-right">{t('Enabled')}</th>
              </tr>
            </thead>
            <tbody>
              {this.state.plugins.map(
                ({id, name, slug, version, author, hasConfiguration, enabled}, idx) => {
                  return (
                    <tr key={id} className={slug}>
                      <td colSpan={2}>
                        <div className={`icon-integration icon-${id}`} />
                        <h5>
                          {`${name} `}
                          <span>{version ? `v${version}` : <em>{t('n/a')}</em>}</span>
                        </h5>
                        <p>
                          {author && (
                            <ExternalLink href={author.url}>{author.name}</ExternalLink>
                          )}
                          {hasConfiguration && (
                            <span>
                              {' '}
                              &middot;{' '}
                              <a href={`/${orgId}/${projectId}/settings/plugins/${id}`}>
                                {t('Configure plugin')}
                              </a>
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="align-right">
                        <Checkbox
                          name={slug}
                          checked={enabled}
                          onChange={evt => this.handleChange(id, !enabled, idx)}
                        />
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}
