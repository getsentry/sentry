import {Component} from 'react';

import EventsTableRow from 'sentry/components/eventsTable/eventsTableRow';
import {t} from 'sentry/locale';
import {Tag} from 'sentry/types';
import {Event} from 'sentry/types/event';

type Props = {
  events: Event[];
  groupId: string;
  orgFeatures: string[];
  orgId: string;
  projectId: string;
  tagList: Tag[];
};
class EventsTable extends Component<Props> {
  render() {
    const {events, tagList, orgId, projectId, groupId, orgFeatures} = this.props;

    const hasUser = !!events.find(event => event.user);

    const showReplayColumn = orgFeatures.includes('session-replay-ui');

    const filteredTagList = tagList.filter(tag => tag.key !== 'replayId');

    return (
      <table className="table events-table" data-test-id="events-table">
        <thead>
          <tr>
            <th>{t('ID')}</th>
            {hasUser && <th>{t('User')}</th>}

            {filteredTagList.map(tag => (
              <th key={tag.key}>{tag.name}</th>
            ))}

            {showReplayColumn && <th>{t('Replay')}</th>}
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
              tagList={filteredTagList}
              hasUser={hasUser}
              showReplayColumn={showReplayColumn}
            />
          ))}
        </tbody>
      </table>
    );
  }
}

export default EventsTable;
