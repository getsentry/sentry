import {useCallback} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {BoxSelectOptions} from 'sentry/views/explore/hooks/useChartBoxSelect';

type Props = {
  boxSelectOptions: BoxSelectOptions;
  triggerWrapperRef: React.RefObject<HTMLDivElement | null>;
};

export function FloatingTrigger({boxSelectOptions, triggerWrapperRef}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const pageCoords = boxSelectOptions.pageCoords;

  const handleZoomIn = useCallback(() => {
    const coordRange = boxSelectOptions.boxCoordRange;
    const startTimestamp = coordRange?.x[0];
    const endTimestamp = coordRange?.x[1];
    const newQuery = {...location.query};

    if (newQuery.statsPeriod) {
      delete newQuery.statsPeriod;
    }

    if (!startTimestamp || !endTimestamp) {
      return;
    }

    newQuery.start = new Date(startTimestamp).toISOString();
    newQuery.end = new Date(endTimestamp).toISOString();

    boxSelectOptions.clearSelection();
    navigate({
      pathname: location.pathname,
      query: newQuery,
    });
  }, [boxSelectOptions, location.pathname, location.query, navigate]);

  const handleFindSuspectAttributes = useCallback(() => {
    // TODO Abdullah Khan: Implement find suspect attributes
  }, []);

  if (!pageCoords) return null;

  return createPortal(
    <div
      ref={triggerWrapperRef}
      style={{
        position: 'absolute',
        top: pageCoords.y,
        left: pageCoords.x,
      }}
    >
      <List>
        <ListItem onClick={handleZoomIn}>{t('Zoom in')}</ListItem>
        <ListItem onClick={handleFindSuspectAttributes}>
          {t('Find Suspect Attributes')}
        </ListItem>
      </List>
    </div>,
    document.body
  );
}

const List = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
  margin-bottom: 0 !important;
  background: ${p => p.theme.backgroundElevated};
  color: ${p => p.theme.textColor};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  overflow: hidden;
`;

const ListItem = styled('li')`
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  cursor: pointer;
  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
  &:last-child {
    border-bottom: 0;
  }
`;
