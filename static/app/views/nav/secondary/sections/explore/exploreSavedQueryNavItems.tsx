import {useEffect, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Reorder, useDragControls} from 'framer-motion';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import type {SavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useReorderStarredSavedQueries} from 'sentry/views/explore/hooks/useReorderStarredSavedQueries';
import {getExploreUrlFromSavedQueryUrl} from 'sentry/views/explore/utils';
import ProjectIcon from 'sentry/views/nav/projectIcon';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';

type Props = {
  queries: SavedQuery[];
};

export function ExploreSavedQueryNavItems({queries}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(queries);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Any time the queries prop changes (e.g. when the user stars or unstars a query),
  // we need to reset the savedQueries state.
  useEffect(() => {
    setSavedQueries(queries);
  }, [queries]);

  const id = getIdFromLocation(location);

  const controls = useDragControls();

  const {projects} = useProjects();

  const reorderStarredSavedQueries = useReorderStarredSavedQueries();

  return (
    <Reorder.Group
      as="div"
      axis="y"
      values={savedQueries}
      onReorder={newOrder => {
        setSavedQueries(newOrder);
      }}
      initial={false}
      ref={sectionRef}
      dragControls={controls}
    >
      {savedQueries?.map(query => (
        <StyledReorderItem
          key={query.id}
          value={query}
          onDragEnd={() => {
            reorderStarredSavedQueries(savedQueries);
          }}
        >
          <GrabHandleWrapper data-test-id={`grab-handle-${query.id}`} data-drag-icon>
            <StyledIconGrabbable color="gray300" />
            <StyledProjectIcon
              projectPlatforms={projects
                .filter(p => query.projects.map(String).includes(p.id))
                .map(p => p.platform)
                .filter(defined)}
            />
          </GrabHandleWrapper>
          <StyledSecondaryNavItem
            key={query.id}
            to={getExploreUrlFromSavedQueryUrl({savedQuery: query, organization})}
            analyticsItemName="explore_starred_item"
            showInteractionStateLayer={false}
            isActive={id === query.id.toString()}
          >
            {query.name}
          </StyledSecondaryNavItem>
          <StyledInteractionStateLayer
            isPressed={id === query.id.toString()}
            hasSelectedBackground={id === query.id.toString()}
          />
        </StyledReorderItem>
      ))}
    </Reorder.Group>
  );
}

const StyledProjectIcon = styled(ProjectIcon)`
  display: flex;
`;

const StyledIconGrabbable = styled(IconGrabbable)`
  display: none;
  width: 18px;
  cursor: grab;
`;

const StyledSecondaryNavItem = styled(SecondaryNav.Item)`
  align-items: center;
  padding-left: ${space(0.75)};
  overflow: hidden;
  width: 100%;
`;

const StyledReorderItem = styled(Reorder.Item)`
  position: relative;
  background-color: transparent;
  border-radius: ${p => p.theme.borderRadius};
  list-style: none;
  display: flex;
  align-items: center;
  margin-bottom: ${space(0.25)};

  &:hover {
    ${StyledProjectIcon} {
      display: none;
    }
    ${StyledIconGrabbable} {
      display: flex;
    }
  }
`;

const GrabHandleWrapper = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(0.5)} 0 ${space(0.5)} ${space(1)};
`;

const StyledInteractionStateLayer = styled(InteractionStateLayer)<{
  hasSelectedBackground: boolean;
}>`
  ${p =>
    p.hasSelectedBackground &&
    css`
      color: ${p.theme.purple400};
      font-weight: ${p.theme.fontWeightBold};

      &:hover {
        color: ${p.theme.purple400};
      }
    `}
`;
