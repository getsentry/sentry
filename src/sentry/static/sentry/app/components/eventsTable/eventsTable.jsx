import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import {t} from 'app/locale';
import CustomPropTypes from 'app/sentryTypes';
import EventsTableRow from 'app/components/eventsTable/eventsTableRow';

class EventsTable extends React.Component {
  static propTypes = {
    events: PropTypes.arrayOf(CustomPropTypes.Event),
    tagList: PropTypes.arrayOf(CustomPropTypes.Tag),
  };

  render() {
    let {className, events, tagList} = this.props;

    let cx = classNames('table events-table', className);
    let hasUser = !!events.find(event => event.user);
    let {orgId, projectId, groupId} = this.props.params;

    return (
      <table className={cx}>
        <thead>
          <tr>
            <th>{t('ID')}</th>
            {hasUser && <th>{t('User')}</th>}

            {tagList.map(tag => {
              return <th key={tag.key}>{tag.name}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          {events.map(event => {
            return (
              <EventsTableRow
                key={event.id}
                event={event}
                orgId={orgId}
                projectId={projectId}
                groupId={groupId}
                tagList={tagList}
                hasUser={hasUser}
              />
            );
          })}
        </tbody>
      </table>
    );
  }
}

export default EventsTable;
