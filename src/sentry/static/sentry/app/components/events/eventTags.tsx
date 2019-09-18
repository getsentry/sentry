import React from 'react';
import {Link} from 'react-router';
import _ from 'lodash';
import queryString from 'query-string';

import {Location} from 'history';
import {Event, EventTag, Group} from 'app/types';

import EventDataSection from 'app/components/events/eventDataSection';
import DeviceName from 'app/components/deviceName';
import {isUrl} from 'app/utils';
import {t} from 'app/locale';
import Pills from 'app/components/pills';
import Pill from 'app/components/pill';
import VersionHoverCard from 'app/components/versionHoverCard';
import InlineSvg from 'app/components/inlineSvg';
import {appendTagCondition} from 'app/utils/queryString';

type EventTagsProps = {
  group: Group;
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
    const query = {...location.query};

    switch (tag.key) {
      case 'environment':
        query.environment = tag.value;
        break;
      case 'project':
        query.project = tag.value;
        break;
      default:
        query.query = appendTagCondition(query.query, tag.key, tag.value);
    }

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
    const {event, group, orgId, hideGuide} = this.props;
    const {tags} = event;

    if (_.isEmpty(tags)) {
      return null;
    }

    const streamPath = `/organizations/${orgId}/issues/`;
    const releasesPath = `/organizations/${orgId}/releases/`;

    return (
      <EventDataSection
        group={group}
        event={event}
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
