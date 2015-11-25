import React from 'react';
import {Link} from 'react-router';
import _ from 'underscore';

import PropTypes from '../../proptypes';

import EventDataSection from './eventDataSection';
import {isUrl} from '../../utils';
import {t} from '../../locale';

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
          type="tags">
        <ul className="mini-tag-list">
          {tags.map((tag) => {
            return (
              <li key={tag.key}>
                {tag.key} = <Link
                  to={`/${orgId}/${projectId}/`}
                  query={{query: `${tag.key}:"${tag.value}"`}}>
                  {tag.value}
                </Link>
                {isUrl(tag.value) &&
                  <a href={tag.value} className="external-icon">
                    <em className="icon-open" />
                  </a>
                }
              </li>
            );
          })}
        </ul>
      </EventDataSection>
    );
  }
});

export default EventTags;
