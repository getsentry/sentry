import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {PanelBody} from 'app/components/panels';
import {ReleaseProject, Release} from 'app/types';
import space from 'app/styles/space';

import ClippedHealthRows from '../clippedHealthRows';
import Header from './header';
import Item from './item';
import ProjectName from './projectName';
import IssuesQuantity from './issuesQuantity';

type Props = {
  projects: Array<ReleaseProject>;
  releaseVersion: Release['version'];
  orgSlug: string;
};

const CompactContent = ({projects, releaseVersion, orgSlug}: Props) => (
  <React.Fragment>
    <Header>{t('Projects')}</Header>
    <PanelBody>
      <StyledClippedHealthRows maxVisibleItems={12}>
        {projects.map(project => {
          const {id, slug, newGroups = 0} = project;
          return (
            <StyledItem key={`${releaseVersion}-${slug}-health`}>
              <ProjectName
                orgSlug={orgSlug}
                project={project}
                releaseVersion={releaseVersion}
              />
              <IssuesQuantity
                orgSlug={orgSlug}
                releaseVersion={releaseVersion}
                projectId={id}
                newGroups={newGroups}
                isCompact
              />
            </StyledItem>
          );
        })}
      </StyledClippedHealthRows>
    </PanelBody>
  </React.Fragment>
);

export default CompactContent;

const StyledItem = styled(Item)`
  align-items: center;
  border-right: 1px solid ${p => p.theme.border};
  display: grid;
  grid-template-columns: minmax(100px, max-content) auto;
  grid-column-gap: ${space(2)};
  justify-content: space-between;
  :last-child {
    border-right: 1px solid ${p => p.theme.border};
  }
`;

const StyledClippedHealthRows = styled(ClippedHealthRows)`
  display: grid;
  grid-template-columns: 1fr;
  margin-right: -1px;
  margin-bottom: -1px;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: repeat(3, 1fr);
  }
  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: repeat(4, 1fr);
  }
`;
