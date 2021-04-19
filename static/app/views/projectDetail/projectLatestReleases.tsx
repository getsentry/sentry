import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import pick from 'lodash/pick';

import {fetchAnyReleaseExistence} from 'app/actionCreators/projects';
import AsyncComponent from 'app/components/asyncComponent';
import {SectionHeading} from 'app/components/charts/styles';
import DateTime from 'app/components/dateTime';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Placeholder from 'app/components/placeholder';
import TextOverflow from 'app/components/textOverflow';
import Version from 'app/components/version';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {IconOpen} from 'app/icons';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, Release} from 'app/types';
import {analytics} from 'app/utils/analytics';
import {RELEASES_TOUR_STEPS} from 'app/views/releases/list/releaseLanding';

import MissingReleasesButtons from './missingFeatureButtons/missingReleasesButtons';
import {SectionHeadingLink, SectionHeadingWrapper, SidebarSection} from './styles';
import {didProjectOrEnvironmentChange} from './utils';

const PLACEHOLDER_AND_EMPTY_HEIGHT = '160px';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projectSlug: string;
  location: Location;
  isProjectStabilized: boolean;
  projectId?: string;
};

type State = {
  releases: Release[] | null;
  hasOlderReleases?: boolean;
} & AsyncComponent['state'];

class ProjectLatestReleases extends AsyncComponent<Props, State> {
  shouldComponentUpdate(nextProps: Props, nextState: State) {
    const {location, isProjectStabilized} = this.props;
    // TODO(project-detail): we temporarily removed refetching based on timeselector
    if (
      this.state !== nextState ||
      didProjectOrEnvironmentChange(location, nextProps.location) ||
      isProjectStabilized !== nextProps.isProjectStabilized
    ) {
      return true;
    }

    return false;
  }

  componentDidUpdate(prevProps: Props) {
    const {location, isProjectStabilized} = this.props;

    if (
      didProjectOrEnvironmentChange(prevProps.location, location) ||
      prevProps.isProjectStabilized !== isProjectStabilized
    ) {
      this.remountComponent();
    }
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {location, organization, projectSlug, isProjectStabilized} = this.props;

    if (!isProjectStabilized) {
      return [];
    }

    const query = {
      ...pick(location.query, Object.values(URL_PARAM)),
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
    const {organization, projectId, isProjectStabilized} = this.props;

    if (!isProjectStabilized) {
      return;
    }

    if ((releases ?? []).length !== 0 || !projectId) {
      this.setState({hasOlderReleases: true});
      return;
    }

    this.setState({loading: true});

    const hasOlderReleases = await fetchAnyReleaseExistence(
      this.api,
      organization.slug,
      projectId
    );

    this.setState({hasOlderReleases, loading: false});
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

  get releasesLink() {
    const {organization} = this.props;

    // as this is a link to latest releases, we want to only preserve project and environment
    return {
      pathname: `/organizations/${organization.slug}/releases/`,
      query: {
        statsPeriod: undefined,
        start: undefined,
        end: undefined,
        utc: undefined,
      },
    };
  }

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
    const {organization, projectId, isProjectStabilized} = this.props;
    const {loading, releases, hasOlderReleases} = this.state;
    const checkingForOlderReleases =
      !(releases ?? []).length && hasOlderReleases === undefined;
    const showLoadingIndicator =
      loading || checkingForOlderReleases || !isProjectStabilized;

    if (showLoadingIndicator) {
      return <Placeholder height={PLACEHOLDER_AND_EMPTY_HEIGHT} />;
    }

    if (!hasOlderReleases) {
      return <MissingReleasesButtons organization={organization} projectId={projectId} />;
    }

    if (!releases || releases.length === 0) {
      return (
        <StyledEmptyStateWarning small>{t('No releases found')}</StyledEmptyStateWarning>
      );
    }

    return <ReleasesTable>{releases.map(this.renderReleaseRow)}</ReleasesTable>;
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    return (
      <SidebarSection>
        <SectionHeadingWrapper>
          <SectionHeading>{t('Latest Releases')}</SectionHeading>
          <SectionHeadingLink to={this.releasesLink}>
            <IconOpen />
          </SectionHeadingLink>
        </SectionHeadingWrapper>
        <div>{this.renderInnerBody()}</div>
      </SidebarSection>
    );
  }
}

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
  line-height: 1.6;
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  height: ${PLACEHOLDER_AND_EMPTY_HEIGHT};
  justify-content: center;
`;

export default ProjectLatestReleases;
