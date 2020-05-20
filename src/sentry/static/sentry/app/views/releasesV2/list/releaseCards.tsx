import React from 'react';
import pick from 'lodash/pick';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import AsyncView from 'app/views/asyncView';
import {Release, GlobalSelection} from 'app/types';
import AsyncComponent from 'app/components/asyncComponent';

import ReleaseCard from './releaseCard';

type Props = {
  releases: Release[];
  orgSlug: string;
  location: Location;
  reloading: boolean;
  selection: GlobalSelection;
};

type State = {
  releasesToRender: Release[];
  releasesWithData: Release[];
} & AsyncView['state'];

class ReleaseCards extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      releasesToRender: this.props.releases,
    };
  }

  getEndpoints(): [string, string, {}][] {
    const {orgSlug, location} = this.props;
    const {statsPeriod, sort} = location.query;

    const query = {
      ...pick(location.query, [
        'project',
        'environment',
        'cursor',
        'query',
        'sort',
        'healthStatsPeriod',
        'healthStat',
      ]),
      summaryStatsPeriod: statsPeriod,
      per_page: 50,
      health: 1,
      flatten: !sort || sort === 'date' ? 0 : 1,
    };

    return [['releasesWithData', `/organizations/${orgSlug}/releases/`, {query}]];
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    super.componentDidUpdate(prevProps, prevState);

    if (!isEqual(this.props.releases, prevProps.releases)) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({releasesToRender: this.props.releases});
    } else if (
      this.state.releasesWithData &&
      !isEqual(this.state.releasesWithData, prevState.releasesWithData)
    ) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState(state => ({
        releasesToRender: state.releasesWithData,
      }));
    }
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {releasesToRender, loading} = this.state;
    const {orgSlug, location, reloading, selection} = this.props;
    return (
      <React.Fragment>
        {releasesToRender.map(release => (
          <ReleaseCard
            release={release}
            orgSlug={orgSlug}
            location={location}
            reloading={reloading}
            key={`${release.version}-${release.projects[0].slug}`}
            showPlaceholders={loading}
            selection={selection}
          />
        ))}
      </React.Fragment>
    );
  }
}

export default ReleaseCards;
