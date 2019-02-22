import React from 'react';
import PropTypes from 'prop-types';

import InlineSvg from 'app/components/inlineSvg';
import TimeSince from 'app/components/timeSince';
import Link from 'app/components/link';
import {t} from 'app/locale';

export default class ReleaseDeploys extends React.Component {
  static propTypes = {
    deploys: PropTypes.array.isRequired,
    version: PropTypes.string.isRequired,
    orgId: PropTypes.string.isRequired,
    // Provided only in the project version of release deploys
    projectId: PropTypes.string,
  };

  getBasePath() {
    const {orgId, projectId} = this.props;

    return projectId ? `/${orgId}/${projectId}/` : `/organizations/${orgId}/issues/`;
  }

  renderEmpty() {
    return <div className="box empty">{t('None')}</div>;
  }

  render() {
    const {deploys, version} = this.props;

    return (
      <React.Fragment>
        <h6 className="nav-header m-b-1">{t('Deploys')}</h6>
        <ul className="nav nav-stacked">
          {!deploys.length
            ? this.renderEmpty()
            : deploys.map(deploy => {
                const path = `${this.getBasePath()}?query=release:${version}&environment=${encodeURIComponent(
                  deploy.environment
                )}`;
                return (
                  <li key={deploy.id}>
                    <Link to={path} title={t('View in stream')}>
                      <div className="row row-flex row-center-vertically">
                        <div className="col-xs-6">
                          <span className="repo-label" style={{verticalAlign: 'bottom'}}>
                            {deploy.environment}
                            <InlineSvg src="icon-open" style={{marginLeft: 6}} />
                          </span>
                        </div>
                        <div className="col-xs-6 align-right">
                          <small>
                            <TimeSince date={deploy.dateFinished} />
                          </small>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
        </ul>
      </React.Fragment>
    );
  }
}
