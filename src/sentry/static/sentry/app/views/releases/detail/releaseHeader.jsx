import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';

import Count from 'app/components/count';
import ExternalLink from 'app/components/links/externalLink';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import PageHeading from 'app/components/pageHeading';
import ReleaseStats from 'app/components/releaseStats';
import TextOverflow from 'app/components/textOverflow';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';

import ReleaseDetailsActions from './releaseDetailActions';

export default class ReleaseHeader extends React.Component {
  static propTypes = {
    release: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
  };

  static contextTypes = {
    location: PropTypes.object,
  };

  render() {
    const {release, orgId} = this.props;

    const releasePath = `/organizations/${orgId}/releases/${encodeURIComponent(
      release.version
    )}/`;

    const links = [
      {title: t('Overview'), to: releasePath},
      {title: t('New Issues'), to: `${releasePath}new-events/`},
      {title: t('All Issues'), to: `${releasePath}all-events/`},
      {title: t('Artifacts'), to: `${releasePath}artifacts/`},
      {title: t('Commits'), to: `${releasePath}commits/`},
    ];

    return (
      <div className="release-details">
        <div className="row">
          <div className="col-sm-4 col-xs-12">
            <PageHeading>{t('Release')} </PageHeading>
            <StyledVersion orgId={orgId} version={release.version} anchor={false} />
            {!!release.url && (
              <div>
                <ExternalLink href={release.url}>
                  <TextOverflow>{release.url}</TextOverflow>
                </ExternalLink>
              </div>
            )}
            <div className="release-meta">
              <span className="icon icon-clock" />{' '}
              <TimeSince date={release.dateCreated} />
            </div>
          </div>
          <div className="col-sm-2 hidden-xs">
            <ReleaseStats release={release} />
          </div>
          <div className="col-sm-2 hidden-xs">
            <div className="release-stats">
              <h6 className="nav-header">{t('New Issues')}</h6>
              <span className="stream-count">
                <Count value={release.newGroups} />
              </span>
            </div>
          </div>
          <div className="col-sm-2 hidden-xs">
            <div className="release-stats">
              <h6 className="nav-header">{t('First Event')}</h6>
              {release.firstEvent ? (
                <span className="stream-count">
                  <TimeSince date={release.firstEvent} />
                </span>
              ) : (
                <span>—</span>
              )}
            </div>
          </div>
          <div className="col-sm-2 hidden-xs">
            <div className="release-stats">
              <h6 className="nav-header">{t('Last Event')}</h6>
              {release.lastEvent ? (
                <span className="stream-count">
                  <TimeSince date={release.lastEvent} />
                </span>
              ) : (
                <span>—</span>
              )}
            </div>
          </div>
        </div>
        <ReleaseDetailsActions api={this.api} orgId={orgId} release={release} />
        <NavTabs>
          {links.map(link => (
            <ListLink
              key={link.to}
              to={`${link.to}${this.context.location.search}`}
              isActive={() => link.to === this.context.location.pathname}
            >
              {link.title}
            </ListLink>
          ))}
        </NavTabs>
      </div>
    );
  }
}

const StyledVersion = styled(Version)`
  font-weight: 600;
  word-break: break-all;
  line-height: 1.2;
  display: block;
  margin: 6px 0;
`;
