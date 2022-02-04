import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import {Panel} from 'sentry/components/panels';
import {Event} from 'sentry/types/event';
import AsyncView from 'sentry/views/asyncView';

type Props = AsyncView['props'] &
  RouteComponentProps<{orgId: string; eventSlug: string}, {}>;

type State = AsyncView['state'] & {
  ReplayEvent: Event | null;
};

class ReplayDetails extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params, location} = this.props;
    return [
      [
        'event',
        `/organizations/${params.orgId}/events/${params.eventSlug}/`,
        {query: location.query},
      ],
    ];
  }

  getTitle() {
    if (this.state.event) {
      return `${this.state.event.id} - Replays - ${this.props.params.orgId}`;
    }
    return `Replays - ${this.props.params.orgId}`;
  }

  onUpdate = (data: Event) =>
    this.setState(state => ({event: {...state.event, ...data}}));

  renderBody() {
    // eslint-disable-next-line no-debugger
    const {event} = this.state;

    if (event === null) {
      return null;
    }

    return (
      <Fragment>
        <Panel style={{paddingBottom: 0}}>lol</Panel>

        <Panel>{event.id}</Panel>
      </Fragment>
    );
  }
}

export default ReplayDetails;
