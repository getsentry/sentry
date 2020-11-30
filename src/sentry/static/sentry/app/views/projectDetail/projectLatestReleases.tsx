import React from 'react';
import {Location} from 'history';
import pick from 'lodash/pick';

import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {SectionHeading} from 'app/components/charts/styles';
import DateTime from 'app/components/dateTime';
import FeatureTourModal from 'app/components/modals/featureTourModal';
import Placeholder from 'app/components/placeholder';
import TextOverflow from 'app/components/textOverflow';
import Version from 'app/components/version';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t} from 'app/locale';
import styled from 'app/styled';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, Release} from 'app/types';
import {analytics} from 'app/utils/analytics';
import {RELEASES_TOUR_STEPS} from 'app/views/releases/list/releaseLanding';

const DOCS_URL = 'https://docs.sentry.io/product/releases/';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projectSlug: string;
  location: Location;
  projectId?: string;
};

type State = {
  releases: Release[] | null;
  hasOlderReleases?: boolean;
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
      <React.Fragment key={release.version}>
        <DateTime date={lastDeploy?.dateFinished || dateCreated} seconds={false} />
        <TextOverflow>
          <StyledVersion
            version={release.version}
            tooltipRawVersion
            projectId={projectId}
          />
        </TextOverflow>
      </React.Fragment>
    );
  };

  renderInnerBody() {
    const {loading, releases, hasOlderReleases} = this.state;
    const checkingForOlderReleases =
      !(releases ?? []).length && hasOlderReleases === undefined;
    const showLoadingIndicator = loading || checkingForOlderReleases;

    if (showLoadingIndicator) {
      return <Placeholder height="160px" />;
    }

    if (!hasOlderReleases) {
      return (
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
      );
    }

    if (!releases || releases.length === 0) {
      return t('No releases match the filter.');
    }

    return <ReleasesTable>{releases.map(this.renderReleaseRow)}</ReleasesTable>;
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
    height: 32px;
  }

  & > *:nth-child(2n + 2) {
    text-align: right;
  }

  & > *:nth-child(4n + 1),
  & > *:nth-child(4n + 2) {
    background-color: ${p => p.theme.rowBackground};
  }
`;

const StyledVersion = styled(Version)`
  ${overflowEllipsis}
`;

export default ProjectLatestReleases;
