import PropTypes from 'prop-types';
import React from 'react';

import {INCIDENT_ACTIVITY_TYPE} from 'app/views/organizationIncidents/utils';
import {
  createIncidentNote,
  deleteIncidentNote,
  fetchIncidentActivities,
  updateIncidentNote,
} from 'app/actionCreators/incident';
import {t} from 'app/locale';
import {uniqueId} from 'app/utils/guid';
import ConfigStore from 'app/stores/configStore';
import withApi from 'app/utils/withApi';

import Activity from './activity';

function makeDefaultErrorJson() {
  return {detail: t('Unknown error. Please try again.')};
}

/**
 * Activity component on Incident Details view
 * Allows user to leave a comment on an incidentId as well as
 * fetch and render existing activity items.
 */
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
        activities: replaceAtArrayIndex(state.activities, index, oldActivity),
      }));
    }
  };

  handleUpdateNote = async (note, activity) => {
    const {api, params} = this.props;
    const {incidentId, orgId} = params;

    const [index, oldActivity] = this.getIndexAndActivityFromState(activity);

    this.setState(state => ({
      activities: replaceAtArrayIndex(state.activities, index, {
        ...oldActivity,
        comment: note.text,
      }),
    }));

    try {
      await updateIncidentNote(api, orgId, incidentId, activity.id, note);
    } catch (error) {
      this.setState(state => ({
        activities: replaceAtArrayIndex(state.activities, index, oldActivity),
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
  const newArray = [...array];
  newArray.splice(index, 1);
  return newArray;
}

function replaceAtArrayIndex(array, index, obj) {
  const newArray = [...array];
  newArray.splice(index, 1, obj);
  return newArray;
}
