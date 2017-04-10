import React from 'react';
import {Link} from 'react-router';
import _ from 'underscore';

import PropTypes from '../../proptypes';

import EventDataSection from './eventDataSection';
import {isUrl, deviceNameMapper} from '../../utils';
import {t} from '../../locale';
import Pills from '../pills';
import Pill from '../pill';

const EventTags = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired
  },

  render() {
    let tags = this.props.event.tags;
    if (_.isEmpty(tags))
      return null;

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
          {tags.map((tag) => {
            return (
              <Pill key={tag.key} name={tag.key}>
                <Link
                  to={{
                    pathname: `/${orgId}/${projectId}/`,
                    query: {query: `${tag.key}:"${tag.value}"`}
                  }}>
                    {deviceNameMapper(tag.value)}
                </Link>
                {isUrl(tag.value) &&
                  <a href={tag.value} className="external-icon">
                    <em className="icon-open" />
                  </a>
                }
              </Pill>
            );
          })}
        </Pills>
      </EventDataSection>
    );
  }
});

export default EventTags;
