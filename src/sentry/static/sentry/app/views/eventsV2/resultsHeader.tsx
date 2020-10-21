import * as React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Organization, SavedQuery} from 'app/types';
import {fetchSavedQuery} from 'app/actionCreators/discoverSavedQueries';
import {Client} from 'app/api';
import TimeSince from 'app/components/timeSince';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import EventView from 'app/utils/discover/eventView';
import * as Layout from 'app/components/layouts/thirds';
import CreateAlertButton from 'app/components/createAlertButton';

import DiscoverBreadcrumb from './breadcrumb';
import EventInputName from './eventInputName';
import SavedQueryButtonGroup from './savedQuery';

type Props = {
  api: Client;
  organization: Organization;
  location: Location;
  errorCode: number;
  eventView: EventView;
  onIncompatibleAlertQuery: React.ComponentProps<
    typeof CreateAlertButton
  >['onIncompatibleQuery'];
};

type State = {
  savedQuery: SavedQuery | undefined;
  loading: boolean;
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
        {t('Created by:')} {createdBy} | {t('Last Edited:')} {lastEdit}
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
    } = this.props;
    const {savedQuery, loading} = this.state;

    return (
      <Layout.Header>
        <Layout.HeaderContent>
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
        </Layout.HeaderContent>
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
          />
        </Layout.HeaderActions>
      </Layout.Header>
    );
  }
}

const Subtitle = styled('h4')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: normal;
  line-height: 1.4;
  color: ${p => p.theme.gray500};
  margin: 0;
`;

export default withApi(ResultsHeader);
