import {Params} from 'react-router/lib/Router';
import { PureComponent } from 'react';

import {Client} from 'app/api';
import {
  createIncidentNote,
  deleteIncidentNote,
  fetchIncidentActivities,
  updateIncidentNote,
} from 'app/actionCreators/incident';
import {replaceAtArrayIndex} from 'app/utils/replaceAtArrayIndex';
import {NoteType} from 'app/types/alerts';
import {CreateError} from 'app/components/activity/note/types';
import {t} from 'app/locale';
import {uniqueId} from 'app/utils/guid';
import ConfigStore from 'app/stores/configStore';
import withApi from 'app/utils/withApi';

import {
  ActivityType,
  ActivityTypeDraft,
  Incident,
  IncidentActivityType,
  IncidentStatus,
} from '../../types';
import Activity from './activity';

function makeDefaultErrorJson() {
  return {detail: t('Unknown error. Please try again.')};
}

type Activities = Array<ActivityType | ActivityType>;

type Props = {
  api: Client;
  incident?: Incident;
  incidentStatus: IncidentStatus | null;
  params: Params;
};

type State = {
  loading: boolean;
  error: boolean;
  noteInputId: string;
  noteInputText: string;
  createBusy: boolean;
  createError: boolean;
  createErrorJSON: null | CreateError;
  activities: null | Activities;
};

/**
 * Activity component on Incident Details view
 * Allows user to leave a comment on an alertId as well as
 * fetch and render existing activity items.
 */
class ActivityContainer extends PureComponent<Props, State> {
  state: State = {
    loading: true,
    error: false,
    noteInputId: uniqueId(),
    noteInputText: '',
    createBusy: false,
    createError: false,
    createErrorJSON: null,
    activities: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
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
    const {alertId, orgId} = params;

    try {
      const activities = await fetchIncidentActivities(api, orgId, alertId);
      this.setState({activities, loading: false});
    } catch (err) {
      this.setState({loading: false, error: !!err});
    }
  }

  handleCreateNote = async (note: NoteType) => {
    const {api, params} = this.props;
    const {alertId, orgId} = params;

    const newActivity: ActivityTypeDraft = {
      comment: note.text,
      type: IncidentActivityType.COMMENT,
      dateCreated: new Date().toISOString(),
      user: ConfigStore.get('user'),
      id: uniqueId(),
      incidentIdentifier: alertId,
    };

    this.setState(state => ({
      createBusy: true,
      // This is passed as a key to NoteInput that re-mounts
      // (basically so we can reset text input to empty string)
      noteInputId: uniqueId(),
      activities: [newActivity, ...(state.activities || [])] as Activities,
      noteInputText: '',
    }));

    try {
      const newNote = await createIncidentNote(api, orgId, alertId, note);

      this.setState(state => {
        // Update activities to replace our fake new activity with activity object from server
        const activities = [
          newNote,
          ...(state.activities!.filter(
            activity => activity !== newActivity
          ) as ActivityType[]),
        ];

        return {
          createBusy: false,
          activities,
        };
      });
    } catch (error) {
      this.setState(state => {
        const activities = state.activities!.filter(activity => activity !== newActivity);

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

  getIndexAndActivityFromState = (activity: ActivityType | ActivityTypeDraft) => {
    // `index` should probably be found, if not let error hit Sentry
    const index =
      this.state.activities !== null
        ? this.state.activities.findIndex(({id}) => id === activity.id)
        : '';
    return [index, this.state.activities![index]];
  };

  handleDeleteNote = async (activity: ActivityType | ActivityTypeDraft) => {
    const {api, params} = this.props;
    const {alertId, orgId} = params;

    const [index, oldActivity] = this.getIndexAndActivityFromState(activity);

    this.setState(state => ({
      activities: removeFromArrayIndex(state.activities!, index),
    }));

    try {
      await deleteIncidentNote(api, orgId, alertId, activity.id);
    } catch (error) {
      this.setState(state => ({
        activities: replaceAtArrayIndex(state.activities!, index, oldActivity),
      }));
    }
  };

  handleUpdateNote = async (
    note: NoteType,
    activity: ActivityType | ActivityTypeDraft
  ) => {
    const {api, params} = this.props;
    const {alertId, orgId} = params;

    const [index, oldActivity] = this.getIndexAndActivityFromState(activity);

    this.setState(state => ({
      activities: replaceAtArrayIndex(state.activities!, index, {
        ...oldActivity,
        comment: note.text,
      }),
    }));

    try {
      await updateIncidentNote(api, orgId, alertId, activity.id, note);
    } catch (error) {
      this.setState(state => ({
        activities: replaceAtArrayIndex(state.activities!, index, oldActivity),
      }));
    }
  };

  render() {
    const {api, params, incident, ...props} = this.props;
    const {alertId} = params;
    const me = ConfigStore.get('user');

    return (
      <Activity
        alertId={alertId}
        me={me}
        api={api}
        {...this.state}
        loading={this.state.loading || !incident}
        incident={incident}
        onCreateNote={this.handleCreateNote}
        onUpdateNote={this.handleUpdateNote}
        onDeleteNote={this.handleDeleteNote}
        {...props}
      />
    );
  }
}
export default withApi(ActivityContainer);

function removeFromArrayIndex<T>(array: T[], index: number): T[] {
  const newArray = [...array];
  newArray.splice(index, 1);
  return newArray;
}
