import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {Reorder, useDragControls} from 'framer-motion';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import {type SavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useReorderStarredSavedQueries} from 'sentry/views/explore/hooks/useReorderStarredSavedQueries';
import {getSavedQueryTraceItemUrl} from 'sentry/views/explore/utils';
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
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setSavedQueries(queries);
  }, [queries]);

  const id = getIdFromLocation(location);

  const controls = useDragControls();

  const {projects} = useProjects();

  const reorderStarredSavedQueries = useReorderStarredSavedQueries();

  const [isDragging, setIsDragging] = useState<number | null>(null);

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
    >
      {savedQueries?.map(query => (
        <StyledReorderItem
          grabbing={isDragging === query.id}
          as="div"
          dragConstraints={sectionRef}
          dragElastic={0.03}
          dragTransition={{bounceStiffness: 400, bounceDamping: 40}}
          // This style is a hack to fix a framer-motion bug that causes views to
          // jump from the bottom of the nav bar to their correct positions
          // upon scrolling down on the page and triggering a page navigation.
          // See: https://github.com/motiondivision/motion/issues/2006
          style={{
            ...(isDragging
              ? {}
              : {
                  originY: '0px',
                }),
          }}
          key={query.id}
          value={query}
          onDragStart={() => {
            setIsDragging(query.id);
          }}
          onDragEnd={() => {
            setIsDragging(null);
            reorderStarredSavedQueries(savedQueries);
          }}
        >
          <StyledSecondaryNavItem
            leadingItems={
              <LeadingItemsWrapper>
                <GrabHandleWrapper
                  data-test-id={`grab-handle-${query.id}`}
                  data-drag-icon
                  onPointerDown={e => {
                    controls.start(e);
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  <StyledInteractionStateLayer isPressed={isDragging === query.id} />
                  <IconGrabbable color="gray300" />
                </GrabHandleWrapper>
                <ProjectIcon
                  projectPlatforms={projects
                    .filter(p => query.projects.map(String).includes(p.id))
                    .map(p => p.platform)
                    .filter(defined)}
                  allProjects={query.projects.length === 1 && query.projects[0] === -1}
                />
              </LeadingItemsWrapper>
            }
            key={query.id}
            to={getSavedQueryTraceItemUrl({savedQuery: query, organization})}
            analyticsItemName="explore_starred_item"
            isActive={id === query.id.toString()}
          >
            <Tooltip title={query.name} position="top" showOnlyOnOverflow skipWrapper>
              <TruncatedTitle>{query.name}</TruncatedTitle>
            </Tooltip>
          </StyledSecondaryNavItem>
        </StyledReorderItem>
      ))}
    </Reorder.Group>
  );
}

const StyledSecondaryNavItem = styled(SecondaryNav.Item)`
  align-items: center;
  padding-right: ${space(0.5)};
  position: relative;

  :not(:hover) {
    [data-drag-icon] {
      ${p => p.theme.visuallyHidden}
    }
  }

  :hover {
    [data-project-icon] {
      ${p => p.theme.visuallyHidden}
    }
  }
`;

const StyledReorderItem = styled(Reorder.Item, {
  shouldForwardProp: prop => prop !== 'grabbing',
})<{grabbing: boolean}>`
  position: relative;
  background-color: ${p => (p.grabbing ? p.theme.colors.surface200 : 'transparent')};
  border-radius: ${p => p.theme.radius.md};
`;

const GrabHandleWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  cursor: grab;
  z-index: 3;

  &:active {
    cursor: grabbing;
  }
`;

const StyledInteractionStateLayer = styled(InteractionStateLayer)`
  height: 120%;
  border-radius: 4px;
`;

const LeadingItemsWrapper = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const TruncatedTitle = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;
