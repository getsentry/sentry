import React from 'react';
import {Location} from 'history';
import pick from 'lodash/pick';

import AsyncComponent from 'app/components/asyncComponent';
import {analytics} from 'app/utils/analytics';
import {Organization, Release} from 'app/types';
import {SectionHeading} from 'app/components/charts/styles';
import {t} from 'app/locale';
import space from 'app/styles/space';
import styled from 'app/styled';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import Placeholder from 'app/components/placeholder';
import ButtonBar from 'app/components/buttonBar';
import Button from 'app/components/button';
import DateTime from 'app/components/dateTime';
import Version from 'app/components/version';
import {RELEASES_TOUR_STEPS} from 'app/views/releases/list/releaseLanding';
import FeatureTourModal from 'app/components/modals/featureTourModal';

const DOCS_URL = 'https://docs.sentry.io/product/releases/';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projectSlug: string;
  projectId: string | undefined;
  location: Location;
};

type State = {
  releases: Release[] | null;
  hasOlderReleases: boolean;
} & AsyncComponent['state'];

class ProjectLatestReleases extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {location, organization, projectSlug} = this.props;

    const query = {
      ...pick(location.query, [...Object.values(URL_PARAM)]),
      per_page: 5,
    };

    // TODO(project-detail): this does not filter releases for the given time
    return [
      ['releases', `/projects/${organization.slug}/${projectSlug}/releases/`, {query}],
    ];
  }

  /**
   * If our releases are empty, determine if we had a release in the last 90 days (empty message differs then)
   */
  async onLoadAllEndpointsSuccess() {
    const {releases} = this.state;
    const {organization, projectSlug} = this.props;

    if ((releases ?? []).length !== 0) {
      this.setState({hasOlderReleases: true});
      return;
    }

    this.setState({loading: true});

    const oldReleases = await this.api.requestPromise(
      `/projects/${organization.slug}/${projectSlug}/releases/`,
      {
        method: 'GET',
        query: {
          statsPeriod: '90d',
          per_page: 1,
        },
      }
    );

    this.setState({hasOlderReleases: oldReleases.length > 0, loading: false});
  }

  handleTourAdvance = (index: number) => {
    const {organization, projectId} = this.props;

    analytics('releases.landing_card_clicked', {
      org_id: parseInt(organization.id, 10),
      project_id: projectId && parseInt(projectId, 10),
      step_id: index,
      step_title: RELEASES_TOUR_STEPS[index].title,
    });
  };

  renderReleaseRow = (release: Release) => {
    const {projectId} = this.props;
    const {lastDeploy, dateCreated} = release;

    return (
      <React.Fragment>
        <DateTime date={lastDeploy?.dateFinished || dateCreated} seconds={false} />
        <VersionWrapper>
          <Version
            version={release.version}
            tooltipRawVersion
            projectId={projectId}
            truncate
          />
        </VersionWrapper>
      </React.Fragment>
    );
  };

  renderInnerBody() {
    const {loading, releases, hasOlderReleases} = this.state;
    const checkingForOlderReleases =
      (releases ?? []).length === 0 && hasOlderReleases === undefined ? true : false;
    const showLoadingIndicator = loading || checkingForOlderReleases;

    if (showLoadingIndicator) {
      return <Placeholder height="160px" />;
    }

    if (!hasOlderReleases) {
      return (
        <div>
          <StyledButtonBar gap={1}>
            <Button size="small" priority="primary" external href={DOCS_URL}>
              {t('Start Setup')}
            </Button>
            <FeatureTourModal
              steps={RELEASES_TOUR_STEPS}
              onAdvance={this.handleTourAdvance}
            >
              {({showModal}) => (
                <Button size="small" onClick={showModal}>
                  {t('Get a tour')}
                </Button>
              )}
            </FeatureTourModal>
          </StyledButtonBar>
        </div>
      );
    }

    if ((releases ?? []).length === 0) {
      return t('No releases match the filter.');
    }

    return <ReleasesTable>{(releases ?? []).map(this.renderReleaseRow)}</ReleasesTable>;
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    return (
      <Section>
        <SectionHeading>{t('Latest Releases')}</SectionHeading>
        <div>{this.renderInnerBody()}</div>
      </Section>
    );
  }
}

const Section = styled('section')`
  margin-bottom: ${space(2)};
`;

const StyledButtonBar = styled(ButtonBar)`
  grid-template-columns: minmax(auto, max-content) minmax(auto, max-content);
`;

const ReleasesTable = styled('div')`
  display: grid;
  font-size: ${p => p.theme.fontSizeMedium};
  white-space: nowrap;
  grid-template-columns: 1fr auto;
  margin-bottom: ${space(2)};

  & > * {
    padding: ${space(0.5)} ${space(1)};
  }

  & > *:nth-child(2n + 2) {
    text-align: right;
  }

  & > *:nth-child(4n + 1),
  & > *:nth-child(4n + 2) {
    background-color: ${p => p.theme.rowBackground};
  }
`;

const VersionWrapper = styled('div')`
  ${overflowEllipsis}
`;

export default ProjectLatestReleases;
