import * as React from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {fetchSavedQuery} from 'sentry/actionCreators/discoverSavedQueries';
import {Client} from 'sentry/api';
import {CreateAlertFromViewButton} from 'sentry/components/createAlertButton';
import * as Layout from 'sentry/components/layouts/thirds';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, SavedQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import withApi from 'sentry/utils/withApi';

import DiscoverBreadcrumb from './breadcrumb';
import EventInputName from './eventInputName';
import SavedQueryButtonGroup from './savedQuery';

type Props = {
  api: Client;
  errorCode: number;
  eventView: EventView;
  location: Location;
  onIncompatibleAlertQuery: React.ComponentProps<
    typeof CreateAlertFromViewButton
  >['onIncompatibleQuery'];
  organization: Organization;
  router: InjectedRouter;
  yAxis: string[];
};

type State = {
  loading: boolean;
  savedQuery: SavedQuery | undefined;
};

class ResultsHeader extends React.Component<Props, State> {
  state: State = {
    savedQuery: undefined,
    loading: true,
  };

  componentDidMount() {
    if (this.props.eventView.id) {
      this.fetchData();
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.eventView &&
      this.props.eventView &&
      prevProps.eventView.id !== this.props.eventView.id
    ) {
      this.fetchData();
    }
  }

  fetchData() {
    const {api, eventView, organization} = this.props;
    if (typeof eventView.id === 'string') {
      this.setState({loading: true});
      fetchSavedQuery(api, organization.slug, eventView.id).then(savedQuery => {
        this.setState({savedQuery, loading: false});
      });
    }
  }

  renderAuthor() {
    const {eventView} = this.props;
    const {savedQuery} = this.state;
    // No saved query in use.
    if (!eventView.id) {
      return null;
    }
    let createdBy = ' \u2014 ';
    let lastEdit: React.ReactNode = ' \u2014 ';
    if (savedQuery !== undefined) {
      createdBy = savedQuery.createdBy?.email || '\u2014';
      lastEdit = <TimeSince date={savedQuery.dateUpdated} />;
    }
    return (
      <Subtitle>
        {t('Created by:')} {createdBy} | {t('Last edited:')} {lastEdit}
      </Subtitle>
    );
  }

  render() {
    const {
      organization,
      location,
      errorCode,
      eventView,
      onIncompatibleAlertQuery,
      yAxis,
      router,
    } = this.props;
    const {savedQuery, loading} = this.state;

    return (
      <Layout.Header>
        <StyledHeaderContent>
          <DiscoverBreadcrumb
            eventView={eventView}
            organization={organization}
            location={location}
          />
          <EventInputName
            savedQuery={savedQuery}
            organization={organization}
            eventView={eventView}
          />
          {this.renderAuthor()}
        </StyledHeaderContent>
        <Layout.HeaderActions>
          <SavedQueryButtonGroup
            location={location}
            organization={organization}
            eventView={eventView}
            savedQuery={savedQuery}
            savedQueryLoading={loading}
            disabled={errorCode >= 400 && errorCode < 500}
            updateCallback={() => this.fetchData()}
            onIncompatibleAlertQuery={onIncompatibleAlertQuery}
            yAxis={yAxis}
            router={router}
          />
        </Layout.HeaderActions>
      </Layout.Header>
    );
  }
}

const Subtitle = styled('h4')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: normal;
  color: ${p => p.theme.gray300};
  margin: ${space(0.5)} 0 0 0;
`;

const StyledHeaderContent = styled(Layout.HeaderContent)`
  overflow: unset;
`;

export default withApi(ResultsHeader);
