import {useCallback, useState} from 'react';
import {createPortal} from 'react-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getUtcDateString} from 'sentry/utils/dates';
import useRouter from 'sentry/utils/useRouter';
import type {ChartInfo} from 'sentry/views/explore/charts';
import {Drawer} from 'sentry/views/explore/components/suspectTags/drawer';
import type {BoxSelectOptions} from 'sentry/views/explore/hooks/useChartBoxSelect';

type Props = {
  boxSelectOptions: BoxSelectOptions;
  chartInfo: ChartInfo;
  triggerWrapperRef: React.RefObject<HTMLDivElement | null>;
};

export function FloatingTrigger({boxSelectOptions, triggerWrapperRef, chartInfo}: Props) {
  const router = useRouter();
  const pageCoords = boxSelectOptions.pageCoords;

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const {openDrawer} = useDrawer();

  const handleZoomIn = useCallback(() => {
    const coordRange = boxSelectOptions.boxCoordRange;
    let startTimestamp = coordRange?.x[0];
    let endTimestamp = coordRange?.x[1];

    if (!startTimestamp || !endTimestamp) {
      return;
    }

    // round off the bounds to the minute
    startTimestamp = Math.floor(startTimestamp / 60_000) * 60_000;
    endTimestamp = Math.ceil(endTimestamp / 60_000) * 60_000;

    // ensure the bounds has 1 minute resolution
    startTimestamp = Math.min(startTimestamp, endTimestamp - 60_000);

    updateDateTime(
      {
        start: getUtcDateString(startTimestamp),
        end: getUtcDateString(endTimestamp),
      },
      router,
      {save: true}
    );
    boxSelectOptions.clearSelection();
  }, [boxSelectOptions, router]);

  const handleFindSuspectAttributes = useCallback(() => {
    if (!isDrawerOpen) {
      setIsDrawerOpen(true);
      openDrawer(
        () => <Drawer chartInfo={chartInfo} boxSelectOptions={boxSelectOptions} />,
        {
          ariaLabel: t('Suspect Attributes Drawer'),
          drawerKey: 'suspect-attributes-drawer',
          resizable: true,
          drawerCss: css`
            height: calc(100% - ${space(4)});
          `,
          onClose: () => {
            setIsDrawerOpen(false);
          },
        }
      );
    }
  }, [boxSelectOptions, chartInfo, isDrawerOpen, openDrawer]);

  if (!pageCoords) return null;

  return createPortal(
    <div
      ref={triggerWrapperRef}
      style={{
        position: 'absolute',
        top: pageCoords.y,
        left: pageCoords.x,
        zIndex: 1000,
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
  font-size: ${p => p.theme.fontSize.md};
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
