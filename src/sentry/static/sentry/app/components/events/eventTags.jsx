import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';
import _ from 'lodash';

import SentryTypes from 'app/sentryTypes';

import EventDataSection from 'app/components/events/eventDataSection';
import DeviceName from 'app/components/deviceName';
import {isUrl} from 'app/utils';
import {t} from 'app/locale';
import Pills from 'app/components/pills';
import Pill from 'app/components/pill';
import VersionHoverCard from 'app/components/versionHoverCard';
import InlineSvg from 'app/components/inlineSvg';

class EventTags extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  render() {
    const tags = this.props.event.tags;
    if (_.isEmpty(tags)) return null;

    const {organization, orgId, projectId} = this.props;

    const hasSentry10 = new Set(organization.features).has('sentry10');

    const streamPath = hasSentry10
      ? `/organizations/${orgId}/issues/`
      : `/${orgId}/${projectId}/`;

    const releasesPath = hasSentry10
      ? `/organizations/${orgId}/releases/`
      : `/${orgId}/${projectId}/releases/`;

    return (
      <EventDataSection
        group={this.props.group}
        event={this.props.event}
        title={t('Tags')}
        type="tags"
        className="p-b-1"
      >
        <Pills className="no-margin">
          {tags.map(tag => {
            return (
              <Pill key={tag.key} name={tag.key}>
                <Link
                  to={{
                    pathname: streamPath,
                    query: {query: `${tag.key}:"${tag.value}"`},
                  }}
                >
                  <DeviceName>{tag.value}</DeviceName>
                </Link>
                {isUrl(tag.value) && (
                  <a href={tag.value} className="external-icon">
                    <em className="icon-open" />
                  </a>
                )}
                {tag.key == 'release' && (
                  <VersionHoverCard
                    containerClassName="pill-icon"
                    version={tag.value}
                    orgId={orgId}
                    projectId={projectId}
                  >
                    <Link to={`${releasesPath}${tag.value}/`}>
                      <InlineSvg src="icon-circle-info" size="14px" />
                    </Link>
                  </VersionHoverCard>
                )}
              </Pill>
            );
          })}
        </Pills>
      </EventDataSection>
    );
  }
}

export default EventTags;
