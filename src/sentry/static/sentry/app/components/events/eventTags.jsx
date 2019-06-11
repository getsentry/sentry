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
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  render() {
    const tags = this.props.event.tags;

    if (_.isEmpty(tags)) {
      return null;
    }

    const {event, group, orgId, projectId} = this.props;

    const streamPath = `/organizations/${orgId}/issues/`;

    const releasesPath = `/organizations/${orgId}/releases/`;

    return (
      <EventDataSection
        group={group}
        event={event}
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
                    query: {
                      query: `${tag.key}:"${tag.value}"`,
                      project: group.project.id,
                    },
                  }}
                >
                  <DeviceName>{tag.value}</DeviceName>
                </Link>
                {isUrl(tag.value) && (
                  <a href={tag.value} className="external-icon">
                    <em className="icon-open" />
                  </a>
                )}
                {tag.key === 'release' && (
                  <VersionHoverCard
                    containerClassName="pill-icon"
                    version={tag.value}
                    orgId={orgId}
                    projectId={projectId}
                  >
                    <Link
                      to={{
                        pathname: `${releasesPath}${tag.value}/`,
                        query: {
                          project: group.project.id,
                        },
                      }}
                    >
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
