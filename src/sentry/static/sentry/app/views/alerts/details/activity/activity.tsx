import * as React from 'react';
import groupBy from 'lodash/groupBy';
import moment from 'moment';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {User} from 'app/types';
import {NoteType} from 'app/types/alerts';
import {t} from 'app/locale';
import ActivityItem from 'app/components/activity/item';
import ErrorBoundary from 'app/components/errorBoundary';
import LoadingError from 'app/components/loadingError';
import Note from 'app/components/activity/note';
import {CreateError} from 'app/components/activity/note/types';
import NoteInputWithStorage from 'app/components/activity/note/inputWithStorage';
import TimeSince from 'app/components/timeSince';
import space from 'app/styles/space';

import {Incident, IncidentActivityType, ActivityType} from '../../types';
import ActivityPlaceholder from './activityPlaceholder';
import DateDivider from './dateDivider';
import StatusItem from './statusItem';

type NoteProps = React.ComponentProps<typeof Note>;

type Props = {
  api: Client;
  alertId: string;
  incident?: Incident;
  loading: boolean;
  error: boolean;
  me: User;
  activities: null | ActivityType[];
  noteInputId: string;
  noteInputProps?: object;

  createError: boolean;
  createBusy: boolean;
  createErrorJSON: null | CreateError;
  onCreateNote: (note: NoteType) => void;
  onUpdateNote: (note: NoteType, activity: ActivityType) => void;
  onDeleteNote: (activity: ActivityType) => void;
};

/**
 * Activity component on Incident Details view
 * Allows user to leave a comment on an alertId as well as
 * fetch and render existing activity items.
 */
class Activity extends React.Component<Props> {
  handleUpdateNote = (note: NoteType, {activity}: NoteProps) => {
    const {onUpdateNote} = this.props;
    onUpdateNote(note, activity as ActivityType);
  };

  handleDeleteNote = ({activity}: NoteProps) => {
    const {onDeleteNote} = this.props;
    onDeleteNote(activity as ActivityType);
  };

  render() {
    const {
      loading,
      error,
      me,
      alertId,
      incident,
      activities,
      noteInputId,
      createBusy,
      createError,
      createErrorJSON,
      onCreateNote,
    } = this.props;

    const noteProps = {
      minHeight: 80,
      projectSlugs: (incident && incident.projects) || [],
      ...this.props.noteInputProps,
    };
    const activitiesByDate = groupBy(activities, ({dateCreated}) =>
      moment(dateCreated).format('ll')
    );
    const today = moment().format('ll');

    return (
      <div>
        <ActivityItem author={{type: 'user', user: me}}>
          {() => (
            <NoteInputWithStorage
              key={noteInputId}
              storageKey="incidentIdinput"
              itemKey={alertId}
              onCreate={onCreateNote}
              busy={createBusy}
              error={createError}
              errorJSON={createErrorJSON}
              placeholder={t(
                'Leave a comment, paste a tweet, or link any other relevant information about this alert...'
              )}
              {...noteProps}
            />
          )}
        </ActivityItem>

        {error && <LoadingError message={t('There was a problem loading activities')} />}

        {loading && (
          <React.Fragment>
            <ActivityPlaceholder />
            <ActivityPlaceholder />
            <ActivityPlaceholder />
          </React.Fragment>
        )}

        {!loading &&
          !error &&
          Object.entries(activitiesByDate).map(([date, activitiesForDate]) => {
            const title =
              date === today ? (
                t('Today')
              ) : (
                <React.Fragment>
                  {date} <StyledTimeSince date={date} />
                </React.Fragment>
              );
            return (
              <React.Fragment key={date}>
                <DateDivider>{title}</DateDivider>
                {activitiesForDate &&
                  activitiesForDate.map(activity => {
                    const authorName = activity.user?.name ?? 'Sentry';

                    if (activity.type === IncidentActivityType.COMMENT) {
                      return (
                        <ErrorBoundary mini key={`note-${activity.id}`}>
                          <Note
                            showTime
                            user={activity.user as User}
                            modelId={activity.id}
                            text={activity.comment || ''}
                            dateCreated={activity.dateCreated}
                            activity={activity}
                            authorName={authorName}
                            onDelete={this.handleDeleteNote}
                            onUpdate={this.handleUpdateNote}
                            {...noteProps}
                          />
                        </ErrorBoundary>
                      );
                    } else {
                      return (
                        <ErrorBoundary mini key={`note-${activity.id}`}>
                          <StatusItem
                            showTime
                            incident={incident}
                            authorName={authorName}
                            activity={activity}
                          />
                        </ErrorBoundary>
                      );
                    }
                  })}
              </React.Fragment>
            );
          })}
      </div>
    );
  }
}

export default Activity;

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeSmall};
  margin-left: ${space(0.5)};
`;
