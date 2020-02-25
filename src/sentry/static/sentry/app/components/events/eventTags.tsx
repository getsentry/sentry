import React from 'react';
import styled from '@emotion/styled';
import {Link} from 'react-router';
import isEmpty from 'lodash/isEmpty';
import queryString from 'query-string';

import {Location} from 'history';
import {Event, EventTag} from 'app/types';

import EventDataSection from 'app/components/events/eventDataSection';
import DeviceName from 'app/components/deviceName';
import {isUrl, generateQueryWithTag} from 'app/utils';
import {t} from 'app/locale';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Pills from 'app/components/pills';
import Pill from 'app/components/pill';
import VersionHoverCard from 'app/components/versionHoverCard';
import InlineSvg from 'app/components/inlineSvg';
import Version from 'app/components/version';
import space from 'app/styles/space';

type DefaultProps = {
  hideGuide: boolean;
};

type Props = DefaultProps & {
  event: Event;
  orgId: string;
  projectId: string;
  location: Location;
};

class EventTags extends React.Component<Props> {
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
          {tag.key === 'release' ? (
            <Version version={tag.value} anchor={false} tooltipRawVersion truncate />
          ) : (
            <DeviceName value={tag.value} />
          )}
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
    const {event, orgId} = this.props;
    const {tags} = event;

    if (isEmpty(tags)) {
      return null;
    }

    const streamPath = `/organizations/${orgId}/issues/`;
    const releasesPath = `/organizations/${orgId}/releases/`;
    const title = (
      <GuideAnchor target="tags" position="top">
        <h3>{t('Tags')}</h3>
      </GuideAnchor>
    );

    return (
      <EventDataSection title={title} wrapTitle={false} type="tags">
        <StyledPills>
          {tags.map(tag => this.renderPill(tag, streamPath, releasesPath))}
        </StyledPills>
      </EventDataSection>
    );
  }
}

const StyledPills = styled(Pills)`
  margin-bottom: ${space(3)};
`;

export default EventTags;
