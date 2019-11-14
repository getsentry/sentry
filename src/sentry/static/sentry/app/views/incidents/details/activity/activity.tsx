import groupBy from 'lodash/groupBy';
import React from 'react';
import moment from 'moment';
import styled from 'react-emotion';

import {Client} from 'app/api';
import {IncidentActivityType} from 'app/views/incidents/utils';
import {User} from 'app/types';
import {t} from 'app/locale';
import ActivityItem from 'app/components/activity/item';
import ErrorBoundary from 'app/components/errorBoundary';
import LoadingError from 'app/components/loadingError';
import Note from 'app/components/activity/note';
import NoteInputWithStorage from 'app/components/activity/note/inputWithStorage';
import TimeSince from 'app/components/timeSince';
import space from 'app/styles/space';

import ActivityPlaceholder from './activityPlaceholder';
import DateDivider from './dateDivider';
import StatusItem from './statusItem';
import {Incident, ActivityType, NoteType} from '../../types';

type Props = {
  api: Client;
  incidentId: string;
  incident?: Incident;
  loading: boolean;
  error: boolean;
  me: User;
  activities: null | ActivityType[];
  noteInputId: string;
  noteInputProps?: object;

  createError: boolean;
  createBusy: boolean;
  createErrorJSON: null | object;
  onCreateNote: (note: NoteType) => void;
  onUpdateNote: (note: NoteType, activity: ActivityType) => void;
  onDeleteNote: (activity: ActivityType) => void;
};

/**
 * Activity component on Incident Details view
 * Allows user to leave a comment on an incidentId as well as
 * fetch and render existing activity items.
 */
class Activity extends React.Component<Props> {
  handleUpdateNote = (note: Note, {activity}) => {
    const {onUpdateNote} = this.props;
    onUpdateNote(note, activity);
  };

  handleDeleteNote = ({activity}) => {
    const {onDeleteNote} = this.props;
    onDeleteNote(activity);
  };

  render() {
    const {
      loading,
      error,
      me,
      incidentId,
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
              itemKey={incidentId}
              onCreate={onCreateNote}
              busy={createBusy}
              error={createError}
              errorJSON={createErrorJSON}
              placeholder={t(
                'Leave a comment, paste a tweet, or link any other relevant information about this Incident...'
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
                'Today'
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
                    const authorName = activity.user ? activity.user.name : 'Sentry';

                    if (activity.type === IncidentActivityType.COMMENT) {
                      return (
                        <ErrorBoundary mini key={`note-${activity.id}`}>
                          <Note
                            showTime
                            user={activity.user}
                            modelId={activity.id}
                            text={activity.comment}
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
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeSmall};
  margin-left: ${space(0.5)};
`;
