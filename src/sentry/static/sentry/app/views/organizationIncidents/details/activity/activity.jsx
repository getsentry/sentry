import {groupBy} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';
import styled from 'react-emotion';

import {INCIDENT_ACTIVITY_TYPE} from 'app/views/organizationIncidents/utils';
import {t} from 'app/locale';
import ActivityItem from 'app/components/activity/item';
import ErrorBoundary from 'app/components/errorBoundary';
import LoadingError from 'app/components/loadingError';
import Note from 'app/components/activity/note';
import NoteInputWithStorage from 'app/components/activity/note/inputWithStorage';
import SentryTypes from 'app/sentryTypes';
import TimeSince from 'app/components/timeSince';
import space from 'app/styles/space';

import ActivityPlaceholder from './activityPlaceholder';
import DateDivider from './dateDivider';
import StatusItem from './statusItem';

/**
 * Activity component on Incident Details view
 * Allows user to leave a comment on an incidentId as well as
 * fetch and render existing activity items.
 */
class Activity extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    incidentId: PropTypes.string.isRequired,
    incident: SentryTypes.Incident,
    loading: PropTypes.bool,
    error: PropTypes.bool,
    me: SentryTypes.User,
    activities: PropTypes.arrayOf(SentryTypes.IncidentActivity),
    noteInputId: PropTypes.string,
    noteInputProps: PropTypes.object,

    createError: PropTypes.bool,
    createBusy: PropTypes.bool,
    createErrorJSON: PropTypes.object,
    onCreateNote: PropTypes.func.isRequired,
    onUpdateNote: PropTypes.func.isRequired,
    onDeleteNote: PropTypes.func.isRequired,
  };

  handleUpdateNote = (note, {activity}) => {
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

                    if (activity.type === INCIDENT_ACTIVITY_TYPE.COMMENT) {
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
