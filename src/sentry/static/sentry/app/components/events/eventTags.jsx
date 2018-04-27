import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';
import _ from 'lodash';

import SentryTypes from 'app/proptypes';

import EventDataSection from 'app/components/events/eventDataSection';
import {isUrl, deviceNameMapper} from 'app/utils';
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
    let tags = this.props.event.tags;
    if (_.isEmpty(tags)) return null;

    let {orgId, projectId} = this.props;
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
                    pathname: `/${orgId}/${projectId}/`,
                    query: {query: `${tag.key}:"${tag.value}"`},
                  }}
                >
                  {deviceNameMapper(tag.value)}
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
                    <Link to={`/${orgId}/${projectId}/releases/${tag.value}/`}>
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
