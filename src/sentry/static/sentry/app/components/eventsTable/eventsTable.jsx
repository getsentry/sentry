import PropTypes from 'prop-types';
import {Component} from 'react';

import {t} from 'app/locale';
import CustomPropTypes from 'app/sentryTypes';
import EventsTableRow from 'app/components/eventsTable/eventsTableRow';

class EventsTable extends Component {
  static propTypes = {
    events: PropTypes.arrayOf(CustomPropTypes.Event),
    tagList: PropTypes.arrayOf(CustomPropTypes.Tag),
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
  };

  render() {
    const {events, tagList, orgId, projectId, groupId} = this.props;

    const hasUser = !!events.find(event => event.user);

    return (
      <table className="table events-table">
        <thead>
          <tr>
            <th>{t('ID')}</th>
            {hasUser && <th>{t('User')}</th>}

            {tagList.map(tag => (
              <th key={tag.key}>{tag.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map(event => (
            <EventsTableRow
              key={event.id}
              event={event}
              orgId={orgId}
              projectId={projectId}
              groupId={groupId}
              tagList={tagList}
              hasUser={hasUser}
            />
          ))}
        </tbody>
      </table>
    );
  }
}

export default EventsTable;
