import {groupBy} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';
import styled from 'react-emotion';

import {INCIDENT_ACTIVITY_TYPE} from 'app/views/organizationIncidents/utils';
import {
  createIncidentNote,
  deleteIncidentNote,
  fetchIncidentActivities,
  updateIncidentNote,
} from 'app/actionCreators/incident';
import {t} from 'app/locale';
import {uniqueId} from 'app/utils/guid';
import ActivityItem from 'app/components/activity/item';
import ConfigStore from 'app/stores/configStore';
import ErrorBoundary from 'app/components/errorBoundary';
import LoadingError from 'app/components/loadingError';
import Note from 'app/components/activity/note';
import NoteInputWithStorage from 'app/components/activity/note/inputWithStorage';
import SentryTypes from 'app/sentryTypes';
import TimeSince from 'app/components/timeSince';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

import ActivityPlaceholder from './activityPlaceholder';
import DateDivider from './dateDivider';

function makeDefaultErrorJson() {
  return {detail: t('Unknown error. Please try again.')};
}

/**
 * Activity component on Incident Details view
 * Allows user to leave a comment on an incidentId as well as
 * fetch and render existing activity items.
 */
class Activity extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    incidentId: PropTypes.string.isRequired,
    loading: PropTypes.bool,
    error: PropTypes.bool,
    me: SentryTypes.User,
    activities: PropTypes.arrayOf(SentryTypes.IncidentActivity),

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
      activities,
      createBusy,
      createError,
      createErrorJSON,
      onCreateNote,
    } = this.props;

    const noteProps = {
      memberList: [],
      teams: [],
      minHeight: 80,
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
              storageKey="incidentIdinput"
              itemKey={incidentId}
              onCreate={onCreateNote}
              busy={createBusy}
              error={createError}
              errorJSON={createErrorJSON}
              placeholder={t(
                'Leave a comment, paste a tweet, or link any other relevant information about this Incident...'
              )}
              sessionUser={me}
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
                      // TODO(billy): This will change depending on the different
                      // activity types we will have to support
                      return (
                        <ErrorBoundary mini key={`note-${activity.id}`}>
                          <ActivityItem
                            showTime
                            item={activity}
                            author={{
                              type: activity.user ? 'user' : 'system',
                              user: activity.user,
                            }}
                            date={activity.dateCreated}
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

class ActivityContainer extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
  };

  state = {
    loading: true,
    error: false,
    createBusy: false,
    createError: false,
    activities: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  async fetchData() {
    const {api, params} = this.props;
    const {incidentId, orgId} = params;

    try {
      const activities = await fetchIncidentActivities(api, orgId, incidentId);
      this.setState({activities, loading: false});
    } catch (err) {
      this.setState({loading: false, error: !!err});
    }
  }

  handleCreateNote = async note => {
    const {api, params} = this.props;
    const {incidentId, orgId} = params;

    this.setState({
      createBusy: true,
    });

    const newActivity = {
      comment: note.text,
      type: INCIDENT_ACTIVITY_TYPE.COMMENT,
      dateCreated: new Date(),
      user: ConfigStore.get('user'),
      id: uniqueId(),
      incidentIdentifier: incidentId,
    };

    this.setState(state => ({
      createBusy: false,

      activities: [newActivity, ...(state.activities || [])],
    }));

    try {
      const newNote = await createIncidentNote(api, orgId, incidentId, note);

      this.setState(state => {
        const activities = [
          newNote,
          ...state.activities.filter(activity => activity !== newActivity),
        ];

        return {
          createBusy: false,
          activities,
        };
      });
    } catch (error) {
      this.setState(state => {
        const activities = state.activities.filter(activity => activity !== newActivity);

        return {
          activities,
          createBusy: false,
          createError: true,
          createErrorJSON: error.responseJSON || makeDefaultErrorJson(),
        };
      });
    }
  };

  getIndexAndActivityFromState = activity => {
    // `index` should probably be found, if not let error hit Sentry
    const index = this.state.activities.findIndex(({id}) => id === activity.id);
    return [index, this.state.activities[index]];
  };

  handleDeleteNote = async activity => {
    const {api, params} = this.props;
    const {incidentId, orgId} = params;

    const [index, oldActivity] = this.getIndexAndActivityFromState(activity);

    this.setState(state => ({
      activities: removeFromArrayIndex(state.activities, index),
    }));

    try {
      await deleteIncidentNote(api, orgId, incidentId, activity.id);
    } catch (error) {
      this.setState(state => ({
        activities: insertAtArrayIndex(state.activities, index, oldActivity),
      }));
    }
  };

  handleUpdateNote = async (note, activity) => {
    const {api, params} = this.props;
    const {incidentId, orgId} = params;

    const [index, oldActivity] = this.getIndexAndActivityFromState(activity);

    this.setState(state => ({
      activities: insertAtArrayIndex(state.activities, index, {
        ...oldActivity,
        comment: note.text,
      }),
    }));

    try {
      await updateIncidentNote(api, orgId, incidentId, activity.id, note);
    } catch (error) {
      this.setState(state => ({
        activities: insertAtArrayIndex(state.activities, index, oldActivity),
      }));
    }
  };

  render() {
    const {api, params, ...props} = this.props;
    const {incidentId, orgId} = params;
    const me = ConfigStore.get('user');

    return (
      <Activity
        incidentId={incidentId}
        orgId={orgId}
        me={me}
        api={api}
        {...this.state}
        onCreateNote={this.handleCreateNote}
        onUpdateNote={this.handleUpdateNote}
        onDeleteNote={this.handleDeleteNote}
        {...props}
      />
    );
  }
}

export default withApi(ActivityContainer);

function removeFromArrayIndex(array, index) {
  return [...array.slice(0, index), ...array.slice(index + 1)];
}

function insertAtArrayIndex(array, index, obj) {
  return [...array.slice(0, index), obj, ...array.slice(index + 1)];
}

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeSmall};
  margin-left: ${space(0.5)};
`;
