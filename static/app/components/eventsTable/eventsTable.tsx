import {Component} from 'react';

import EventsTableRow from 'sentry/components/eventsTable/eventsTableRow';
import {t} from 'sentry/locale';
import {Tag} from 'sentry/types';
import {Event} from 'sentry/types/event';

type Props = {
  events: Event[];
  groupId: string;
  orgId: string;
  projectId: string;
  tagList: Tag[];
};
class EventsTable extends Component<Props> {
  render() {
    const {events, tagList, orgId, projectId, groupId} = this.props;

    const hasUser = !!events.find(event => event.user);

    return (
      <table className="table events-table" data-test-id="events-table">
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
