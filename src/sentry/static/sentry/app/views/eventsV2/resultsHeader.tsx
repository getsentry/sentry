import React from 'react';
import {Location} from 'history';

import {Organization, SavedQuery} from 'app/types';
import {fetchSavedQuery} from 'app/actionCreators/discoverSavedQueries';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import Hovercard from 'app/components/hovercard';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';

import DiscoverBreadcrumb from './breadcrumb';
import EventInputName from './eventInputName';
import EventView from './eventView';
import SavedQueryButtonGroup from './savedQuery';
import {HeaderBox, HeaderControls} from './styles';

type Props = {
  api: Client;
  organization: Organization;
  location: Location;
  eventView: EventView;
};

type State = {
  savedQuery: SavedQuery | undefined;
  loading: boolean;
};

class ResultsHeader extends React.Component<Props, State> {
  state = {
    savedQuery: undefined,
    loading: true,
  };

  componentDidMount() {
    if (this.props.eventView.id) {
      this.fetchData();
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.eventView !== this.props.eventView) {
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

  render() {
    const {organization, location, eventView} = this.props;
    const {savedQuery, loading} = this.state;

    const renderDisabled = p => (
      <Hovercard
        body={
          <FeatureDisabled
            features={p.features}
            hideHelpToggle
            message={t('Discover queries are disabled')}
            featureName={t('Discover queries')}
          />
        }
      >
        {p.children(p)}
      </Hovercard>
    );

    return (
      <HeaderBox>
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
        <HeaderControls>
          <Feature
            organization={organization}
            features={['discover-query']}
            hookName="feature-disabled:discover-saved-query-create"
            renderDisabled={renderDisabled}
          >
            {({hasFeature}) => (
              <SavedQueryButtonGroup
                location={location}
                organization={organization}
                eventView={eventView}
                savedQuery={savedQuery}
                savedQueryLoading={loading}
                disabled={!hasFeature}
              />
            )}
          </Feature>
        </HeaderControls>
      </HeaderBox>
    );
  }
}

export default withApi(ResultsHeader);
