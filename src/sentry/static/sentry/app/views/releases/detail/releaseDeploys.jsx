import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {IconOpen} from 'app/icons';
import Link from 'app/components/links/link';
import RepoLabel from 'app/components/repoLabel';
import TimeSince from 'app/components/timeSince';

export default class ReleaseDeploys extends React.Component {
  static propTypes = {
    deploys: PropTypes.array.isRequired,
    version: PropTypes.string.isRequired,
    orgId: PropTypes.string.isRequired,
  };

  renderEmpty() {
    return <div className="box empty">{t('None')}</div>;
  }

  render() {
    const {deploys, version, orgId} = this.props;

    return (
      <React.Fragment>
        <h6 className="nav-header m-b-1">{t('Deploys')}</h6>
        <ul className="nav nav-stacked">
          {!deploys.length
            ? this.renderEmpty()
            : deploys.map(deploy => {
                const path = `/organizations/${orgId}/issues/?query=release:${version}&environment=${encodeURIComponent(
                  deploy.environment
                )}`;
                return (
                  <li key={deploy.id}>
                    <Link to={path} title={t('View in stream')}>
                      <div className="row row-flex row-center-vertically">
                        <div className="col-xs-6">
                          <ReleaseRepoLabel>
                            {deploy.environment}
                            <StyledIconOpen size="xs" />
                          </ReleaseRepoLabel>
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

const StyledIconOpen = styled(IconOpen)`
  margin-left: 6px;
`;

const ReleaseRepoLabel = styled(RepoLabel)`
  padding: 5px 8px;
  vertical-align: bottom;
`;
