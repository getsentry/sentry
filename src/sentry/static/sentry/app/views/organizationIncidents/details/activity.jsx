import {groupBy} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';
import styled from 'react-emotion';

import {
  createIncidentNote,
  deleteIncidentNote,
  fetchIncidentActivities,
  updateIncidentNote,
} from 'app/actionCreators/incident';
import {t} from 'app/locale';
import {uniqueId} from 'app/utils/guid';
import ActivityItem from 'app/components/activity/item';
import Avatar from 'app/components/avatar';
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
    activities: PropTypes.arrayOf(SentryTypes.Activity),
  };

  state = {
    createBusy: false,
    updateBusy: false,
    requestError: false,
    errorJSON: null,
  };

  /**
   * Note: This is nearly the same logic as `app/views/groupDetails/shared/groupActivity`
   * This can be abstracted a bit if we create more objects that can have activities
   */
  handleCreateNote = async note => {
    const {api, incidentId} = this.props;

    this.setState({
      createBusy: true,
    });

    try {
      await createIncidentNote(api, incidentId, note);

      this.setState({
        createBusy: false,

        // This is used as a `key` to Note Input so that after successful post
        // we reset the value of the input
        inputId: uniqueId(),
      });
    } catch (error) {
      // TODO: Optimistic update
      this.setState({
        createBusy: false,
        requestError: true,
        errorJSON: error.responseJSON || makeDefaultErrorJson(),
      });
    }
  };

  handleDeleteNote = async item => {
    const {api, incidentId} = this.props;

    try {
      await deleteIncidentNote(api, incidentId, item);
    } catch (error) {
      // TODO: Optimistic update
    }
  };

  handleUpdateNote = async (note, item) => {
    const {api, incidentId} = this.props;

    this.setState({
      updateBusy: true,
    });

    try {
      await updateIncidentNote(api, incidentId, item, note);
      this.setState({
        updateBusy: false,
      });
    } catch (error) {
      this.setState({
        updateBusy: false,
        requestError: true,
        errorJSON: error.responseJSON || makeDefaultErrorJson(),
      });
      // TODO: Optimistic update
    }
  };

  render() {
    const {loading, error, me, incidentId, activities} = this.props;
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
              onCreate={this.handleCreateNote}
              busy={this.state.createBusy}
              error={this.state.requestError}
              errorJSON={this.state.errorJSON}
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

                    if (activity.type === 'note') {
                      return (
                        <ErrorBoundary mini key={`note-${activity.id}`}>
                          <Note
                            showTime
                            item={activity}
                            id={`note-${activity.id}`}
                            author={{
                              name: authorName,
                              avatar: <Avatar user={activity.user} size={38} />,
                            }}
                            onDelete={this.handleDeleteNote}
                            onUpdate={this.handleUpdateNote}
                            busy={this.state.updateBusy}
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
      this.setState({loading: false, error: err});
    }
  }

  render() {
    const {loading, error, activities} = this.state;
    const {api, params, ...props} = this.props;
    const {incidentId, orgId} = params;
    const me = ConfigStore.get('user');

    return (
      <Activity
        incidentId={incidentId}
        orgId={orgId}
        loading={loading}
        error={error}
        me={me}
        activities={activities}
        api={api}
        {...props}
      />
    );
  }
}

export default withApi(ActivityContainer);

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeSmall};
  margin-left: ${space(0.5)};
`;
