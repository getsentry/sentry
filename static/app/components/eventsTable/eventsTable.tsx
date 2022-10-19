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

    const replayIndex = tagList.findIndex(tag => tag.key === 'replayId');
    const replayColumn =
      orgFeatures.includes('session-replay-ui') &&
      replayIndex !== -1 &&
      tagList.splice(replayIndex, replayIndex + 1).at(0);

    return (
      <table className="table events-table" data-test-id="events-table">
        <thead>
          <tr>
            <th>{t('ID')}</th>
            {hasUser && <th>{t('User')}</th>}

            {tagList.map(tag => (
              <th key={tag.key}>{tag.name}</th>
            ))}
            {replayColumn && <th>{t('Replay')}</th>}
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
              hasReplay={Boolean(replayColumn)}
            />
          ))}
        </tbody>
      </table>
    );
  }
}

export default EventsTable;
