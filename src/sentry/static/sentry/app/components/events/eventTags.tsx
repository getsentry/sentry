import React from 'react';
import {Link} from 'react-router';
import isEmpty from 'lodash/isEmpty';
import queryString from 'query-string';

import {Location} from 'history';
import {Event, EventTag} from 'app/types';

import EventDataSection from 'app/components/events/eventDataSection';
import DeviceName from 'app/components/deviceName';
import {isUrl, generateQueryWithTag} from 'app/utils';
import {t} from 'app/locale';
import Pills from 'app/components/pills';
import Pill from 'app/components/pill';
import VersionHoverCard from 'app/components/versionHoverCard';
import InlineSvg from 'app/components/inlineSvg';

type EventTagsProps = {
  event: Event;
  orgId: string;
  projectId: string;
  hideGuide: boolean;

  location: Location;
};

class EventTags extends React.Component<EventTagsProps> {
  static defaultProps = {
    hideGuide: false,
  };

  renderPill(tag: EventTag, streamPath: string, releasesPath: string) {
    const {orgId, projectId, location} = this.props;
    const query = generateQueryWithTag(location.query, tag);

    const locationSearch = `?${queryString.stringify(query)}`;

    return (
      <Pill key={tag.key} name={tag.key} value={tag.value}>
        <Link
          to={{
            pathname: streamPath,
            search: locationSearch,
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
                search: locationSearch,
              }}
            >
              <InlineSvg src="icon-circle-info" size="14px" />
            </Link>
          </VersionHoverCard>
        )}
      </Pill>
    );
  }

  render() {
    const {event, orgId, hideGuide} = this.props;
    const {tags} = event;

    if (isEmpty(tags)) {
      return null;
    }

    const streamPath = `/organizations/${orgId}/issues/`;
    const releasesPath = `/organizations/${orgId}/releases/`;

    return (
      <EventDataSection
        title={t('Tags')}
        type="tags"
        className="p-b-1"
        hideGuide={hideGuide}
      >
        <Pills className="no-margin">
          {tags.map(tag => this.renderPill(tag, streamPath, releasesPath))}
        </Pills>
      </EventDataSection>
    );
  }
}

export default EventTags;
