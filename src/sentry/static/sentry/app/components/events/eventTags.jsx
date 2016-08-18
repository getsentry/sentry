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

    // aggregate values with the same key
    // from [{key: foo, value: bar}, {key: foo, value: bar2}] into [{key: foo, values: [bar, bar2]}]

    let results = [];
    for (var ti in tags) {
      var tag = tags[ti];
      var found = false;
      for (var r in results) {
        var result = results[r];
        if (result.key == tag.key) {
          // we found the key in result. Simply append to the values
          result.values.push(tag.value);
          found = true;
          break;
        }
      }
      if (!found) {
        // need to create a new key in result
        results.push({key: tag.key, values: [tag.value]});
      }
    }

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
          {results.map((tag) => {
            return (
              <li key={tag.key}>
                {tag.key} = {tag.values.map((value) => {
                  return (
                    <span>
                      <Link
                        to={`/${orgId}/${projectId}/`}
                        query={{query: `${tag.key}:"${value}"`}}>
                        {value}
                      </Link>
                      {isUrl(value) &&
                        <a href={value} className="external-icon">
                          <em className="icon-open" />
                        </a>
                      }
                      <span>&nbsp;&nbsp;</span>
                    </span>
                  );
                })}
              </li>
            );
          })}
        </ul>
      </EventDataSection>
    );
  }
});

export default EventTags;
