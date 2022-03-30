import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import NotFound from 'sentry/components/errors/notFound';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Event} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import AsyncView from 'sentry/views/asyncView';

import ReplayEvents from './detail/replayEvents';

type Props = AsyncView['props'] &
  RouteComponentProps<{orgId: string; replayId: string}, {}>;

type State = AsyncView['state'] & {
  event: Event | undefined;
  eventView: EventView;
};

class ReplayDetails extends AsyncView<Props, State> {
  state: State = {
    eventView: EventView.fromLocation(this.props.location),
    loading: true,
    reloading: false,
    error: false,
    errors: {},
    event: undefined,
  };

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params, location} = this.props;

    const eventList = EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: ['timestamp', 'replayId'],
      orderby: 'timestamp',
      projects: [],
      range: '14d',
      query: `transaction:sentry-replay`,
    });
    eventList.additionalConditions.addFilterValues('replayId', [params.replayId]);
    const apiPayload = eventList.getEventsAPIPayload(location);

    return [
      ['eventList', `/organizations/${params.orgId}/eventsv2/`, {query: apiPayload}],
    ];
  }

  getTitle() {
    if (this.state.event) {
      return `${this.state.event.id} - Replays - ${this.props.params.orgId}`;
    }
    return `Replays - ${this.props.params.orgId}`;
  }

  renderLoading() {
    return <PageContent>{super.renderLoading()}</PageContent>;
  }

  renderBody() {
    const {eventList} = this.state;
    const orgSlug = this.props.params.orgId;
    if (!eventList) {
      return <NotFound />;
    }

    const eventSlugs = eventList.data.map(event =>
      generateEventSlug({
        project: event['project.name'],
        id: event.id,
      })
    );

    return (
      <NoPaddingContent>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  to: `/organizations/${orgSlug}/replays/`,
                  label: t('Replays'),
                },
                {label: t('Replay Details')}, // TODO: put replay ID or something here
              ]}
            />
            <TitleWrapper>Replay: {this.props.params.replayId}</TitleWrapper>
          </Layout.HeaderContent>
        </Layout.Header>

        <ReplayEvents {...this.props} eventSlugs={eventSlugs} />
      </NoPaddingContent>
    );
  }
}

const TitleWrapper = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  margin-top: 20px;
`;

const NoPaddingContent = styled(PageContent)`
  padding: 0;
`;

export default ReplayDetails;
