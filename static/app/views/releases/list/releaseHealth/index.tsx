import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import partition from 'lodash/partition';

import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import {tct, tn} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization, Release} from 'app/types';

import {ReleaseHealthRequestRenderProps} from '../../utils/releaseHealthRequest';
import {DisplayOption} from '../utils';

import Content from './content';

type Props = {
  release: Release;
  organization: Organization;
  activeDisplay: DisplayOption;
  location: Location;
  showPlaceholders: boolean;
  selection: GlobalSelection;
  reloading: boolean;
  isTopRelease: boolean;
  getHealthData: ReleaseHealthRequestRenderProps['getHealthData'];
};

class ReleaseHealth extends Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    // we don't want project health rows to reorder/jump while the whole card is loading
    if (this.props.reloading && nextProps.reloading) {
      return false;
    }

    return true;
  }

  render() {
    const {
      release,
      organization,
      activeDisplay,
      location,
      showPlaceholders,
      selection,
      isTopRelease,
      getHealthData,
    } = this.props;

    // sort health rows inside release card alphabetically by project name,
    // show only the ones that are selected in global header
    const [projectsToShow, projectsToHide] = partition(
      release.projects.sort((a, b) => a.slug.localeCompare(b.slug)),
      p =>
        // do not filter for My Projects & All Projects
        selection.projects.length > 0 && !selection.projects.includes(-1)
          ? selection.projects.includes(p.id)
          : true
    );

    function getHiddenProjectsTooltip() {
      const limitedProjects = projectsToHide.map(p => p.slug).slice(0, 5);
      const remainderLength = projectsToHide.length - limitedProjects.length;

      if (remainderLength) {
        limitedProjects.push(tn('and %s more', 'and %s more', remainderLength));
      }

      return limitedProjects.join(', ');
    }

    return (
      <Fragment>
        <Content
          organization={organization}
          activeDisplay={activeDisplay}
          releaseVersion={release.version}
          showAdoptionStageLabels={selection.environments.length === 1}
          adoptionStages={release.adoptionStages}
          projects={projectsToShow}
          location={location}
          showPlaceholders={showPlaceholders}
          isTopRelease={isTopRelease}
          getHealthData={getHealthData}
        />

        {projectsToHide.length > 0 && (
          <HiddenProjectsMessage>
            <Tooltip title={getHiddenProjectsTooltip()}>
              <TextOverflow>
                {projectsToHide.length === 1
                  ? tct('[number:1] hidden project', {number: <strong />})
                  : tct('[number] hidden projects', {
                      number: <strong>{projectsToHide.length}</strong>,
                    })}
              </TextOverflow>
            </Tooltip>
          </HiddenProjectsMessage>
        )}
      </Fragment>
    );
  }
}

const HiddenProjectsMessage = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  padding: 0 ${space(2)};
  border-top: 1px solid ${p => p.theme.border};
  overflow: hidden;
  height: 24px;
  line-height: 24px;
  color: ${p => p.theme.gray300};
  background-color: ${p => p.theme.backgroundSecondary};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    border-bottom-left-radius: ${p => p.theme.borderRadius};
  }
`;

export default ReleaseHealth;
