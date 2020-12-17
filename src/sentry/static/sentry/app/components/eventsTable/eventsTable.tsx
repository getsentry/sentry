import React from 'react';
import PropTypes from 'prop-types';

import EventsTableRow from 'app/components/eventsTable/eventsTableRow';
import {t} from 'app/locale';
import CustomPropTypes from 'app/sentryTypes';
import {Event, Tag} from 'app/types';

type Props = {
  events: Event[];
  tagList: Tag[];
  orgId: string;
  projectId: string;
  groupId: string;
};
class EventsTable extends React.Component<Props> {
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
