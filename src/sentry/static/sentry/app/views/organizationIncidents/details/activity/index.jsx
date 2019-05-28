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
class ActivityContainer extends React.PureComponent {
  static propTypes = {
    api: PropTypes.object.isRequired,
    incidentStatus: PropTypes.number,
  };

  state = {
    loading: true,
    error: false,
    noteInputId: uniqueId(),
    noteInputText: '',
    createBusy: false,
    createError: false,
    activities: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    // Only refetch if incidentStatus changes.
    //
    // This component can mount before incident details is fully loaded.
    // In which case, `incidentStatus` is null and we will be fetching via `cDM`
    // There's no need to fetch this gets updated due to incident details being loaded
    if (
      prevProps.incidentStatus !== null &&
      prevProps.incidentStatus !== this.props.incidentStatus
    ) {
      this.fetchData();
    }
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

    const newActivity = {
      comment: note.text,
      type: INCIDENT_ACTIVITY_TYPE.COMMENT,
      dateCreated: new Date(),
      user: ConfigStore.get('user'),
      id: uniqueId(),
      incidentIdentifier: incidentId,
    };

    this.setState(state => ({
      createBusy: true,
      // This is passed as a key to NoteInput that re-mounts
      // (basically so we can reset text input to empty string)
      noteInputId: uniqueId(),
      activities: [newActivity, ...(state.activities || [])],
      noteInputText: '',
    }));

    try {
      const newNote = await createIncidentNote(api, orgId, incidentId, note);

      this.setState(state => {
        // Update activities to replace our fake new activity with activity object from server
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
          // We clear the textarea immediately when submitting, restore
          // value when there has been an error
          noteInputText: note.text,
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
        noteInputId={this.state.noteInputId}
        incidentId={incidentId}
        orgId={orgId}
        me={me}
        api={api}
        noteProps={{
          text: this.state.noteInputText,
        }}
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
