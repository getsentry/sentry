import {memo, MouseEventHandler, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import Button from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import {ExportProfileButton} from 'sentry/components/profiling/exportProfileButton';
import {IconPanel} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {filterFlamegraphTree} from 'sentry/utils/profiling/filterFlamegraphTree';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphPreferences';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {invertCallTree} from 'sentry/utils/profiling/profile/utils';
import {makeFormatter} from 'sentry/utils/profiling/units/units';
import {useParams} from 'sentry/utils/useParams';

import {FrameStackTable} from './frameStackTable';

interface FrameStackProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraph: Flamegraph;
  formatDuration: Flamegraph['formatter'];
  getFrameColor: (frame: FlamegraphFrame) => string;
  profileGroup: ProfileGroup;
  referenceNode: FlamegraphFrame;
  rootNodes: FlamegraphFrame[];
  onResize?: MouseEventHandler<HTMLElement>;
}

const FrameStack = memo(function FrameStack(props: FrameStackProps) {
  const params = useParams();
  const [flamegraphPreferences, dispatchFlamegraphPreferences] =
    useFlamegraphPreferences();

  const [tab, setTab] = useState<'bottom up' | 'call order'>('call order');
  const [detailsTab, setDetailsTab] = useState<'device' | 'transaction'>('transaction');
  const [treeType, setTreeType] = useState<'all' | 'application' | 'system'>('all');
  const [recursion, setRecursion] = useState<'collapsed' | null>(null);

  const maybeFilteredOrInvertedTree: FlamegraphFrame[] | null = useMemo(() => {
    const skipFunction: (f: FlamegraphFrame) => boolean =
      treeType === 'application'
        ? f => !f.frame.is_application
        : treeType === 'system'
        ? f => f.frame.is_application
        : () => false;

    const maybeFilteredRoots =
      treeType !== 'all'
        ? filterFlamegraphTree(props.rootNodes, skipFunction)
        : props.rootNodes;

    if (tab === 'call order') {
      return maybeFilteredRoots;
    }

    return invertCallTree(maybeFilteredRoots);
  }, [tab, treeType, props.rootNodes]);

  const handleRecursionChange = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      setRecursion(evt.currentTarget.checked ? 'collapsed' : null);
    },
    []
  );

  const onBottomUpClick = useCallback(() => {
    setTab('bottom up');
  }, []);

  const onCallOrderClick = useCallback(() => {
    setTab('call order');
  }, []);

  const onAllApplicationsClick = useCallback(() => {
    setTreeType('all');
  }, []);

  const onApplicationsClick = useCallback(() => {
    setTreeType('application');
  }, []);

  const onSystemsClick = useCallback(() => {
    setTreeType('system');
  }, []);

  const onDeviceTabClick = useCallback(() => {
    setDetailsTab('device');
  }, []);

  const onTransactionTabClick = useCallback(() => {
    setDetailsTab('transaction');
  }, []);

  const onTableLeftClick = useCallback(() => {
    dispatchFlamegraphPreferences({type: 'set layout', payload: 'table left'});
  }, [dispatchFlamegraphPreferences]);

  const onTableBottomClick = useCallback(() => {
    dispatchFlamegraphPreferences({type: 'set layout', payload: 'table bottom'});
  }, [dispatchFlamegraphPreferences]);

  const onTableRightClick = useCallback(() => {
    dispatchFlamegraphPreferences({type: 'set layout', payload: 'table right'});
  }, [dispatchFlamegraphPreferences]);

  return (
    <FrameDrawer layout={flamegraphPreferences.layout}>
      <FrameTabs>
        <ListItem className={tab === 'bottom up' ? 'active' : undefined}>
          <Button
            data-title={t('Bottom Up')}
            priority="link"
            size="zero"
            onClick={onBottomUpClick}
          >
            {t('Bottom Up')}
          </Button>
        </ListItem>
        <ListItem margin="none" className={tab === 'call order' ? 'active' : undefined}>
          <Button
            data-title={t('Call Order')}
            priority="link"
            size="zero"
            onClick={onCallOrderClick}
          >
            {t('Call Order')}
          </Button>
        </ListItem>
        <Separator />
        <ListItem className={treeType === 'all' ? 'active' : undefined}>
          <Button
            data-title={t('All Frames')}
            priority="link"
            size="zero"
            onClick={onAllApplicationsClick}
          >
            {t('All Frames')}
          </Button>
        </ListItem>
        <ListItem className={treeType === 'application' ? 'active' : undefined}>
          <Button
            data-title={t('Application Frames')}
            priority="link"
            size="zero"
            onClick={onApplicationsClick}
          >
            {t('Application Frames')}
          </Button>
        </ListItem>
        <ListItem margin="none" className={treeType === 'system' ? 'active' : undefined}>
          <Button
            data-title={t('System Frames')}
            priority="link"
            size="zero"
            onClick={onSystemsClick}
          >
            {t('System Frames')}
          </Button>
        </ListItem>
        <Separator />
        <ListItem>
          <FrameDrawerLabel>
            <input
              type="checkbox"
              checked={recursion === 'collapsed'}
              onChange={handleRecursionChange}
            />
            {t('Collapse recursion')}
          </FrameDrawerLabel>
        </ListItem>
        <ListItem
          style={{
            flex: '1 1 100%',
            cursor:
              flamegraphPreferences.layout === 'table bottom' ? 'ns-resize' : undefined,
          }}
          onMouseDown={
            flamegraphPreferences.layout === 'table bottom' ? props.onResize : undefined
          }
        />
        <ListItem margin="none">
          <ExportProfileButton
            variant="xs"
            eventId={params.eventId}
            orgId={params.orgId}
            projectId={params.projectId}
            disabled={
              params.eventId === undefined ||
              params.orgId === undefined ||
              params.projectId === undefined
            }
          />
        </ListItem>
        <Separator />
        <ListItem>
          <LayoutSelectionContainer>
            <StyledButton
              active={flamegraphPreferences.layout === 'table left'}
              onClick={onTableLeftClick}
              size="xs"
              title={t('Table left')}
            >
              <IconPanel size="xs" direction="right" />
            </StyledButton>
            <StyledButton
              active={flamegraphPreferences.layout === 'table bottom'}
              onClick={onTableBottomClick}
              size="xs"
              title={t('Table bottom')}
            >
              <IconPanel size="xs" direction="down" />
            </StyledButton>
            <StyledButton
              active={flamegraphPreferences.layout === 'table right'}
              onClick={onTableRightClick}
              size="xs"
              title={t('Table right')}
            >
              <IconPanel size="xs" direction="left" />
            </StyledButton>
          </LayoutSelectionContainer>
        </ListItem>
      </FrameTabs>

      <FrameStackTable
        {...props}
        recursion={recursion}
        referenceNode={props.referenceNode}
        tree={maybeFilteredOrInvertedTree ?? []}
        canvasPoolManager={props.canvasPoolManager}
      />
      <ProfileDetails layout={flamegraphPreferences.layout}>
        <FrameTabs>
          <ListItem
            size="sm"
            className={detailsTab === 'transaction' ? 'active' : undefined}
          >
            <Button
              data-title={t('Transaction')}
              priority="link"
              size="zero"
              onClick={onTransactionTabClick}
            >
              {t('Transaction')}
            </Button>
          </ListItem>
          <ListItem size="sm" className={detailsTab === 'device' ? 'active' : undefined}>
            <Button
              data-title={t('Device')}
              priority="link"
              size="zero"
              onClick={onDeviceTabClick}
            >
              {t('Device')}
            </Button>
          </ListItem>
        </FrameTabs>

        {detailsTab === 'device' ? (
          <DetailsContainer>
            <DetailsRow>
              {Object.entries(DEVICE_DETAILS_KEY).map(([label, key]) => {
                const value = props.profileGroup.metadata[key];
                return (
                  <DetailsRow key={key}>
                    <span>
                      <strong>{label}</strong>:
                    </span>{' '}
                    <span>
                      {key === 'durationNS'
                        ? nsFormatter(value)
                        : value === undefined || value === ''
                        ? t('ø')
                        : value}
                    </span>
                  </DetailsRow>
                );
              })}
            </DetailsRow>
          </DetailsContainer>
        ) : (
          <DetailsContainer>
            {Object.entries(PROFILE_DETAILS_KEY).map(([label, key]) => {
              const value = props.profileGroup.metadata[key];

              return (
                <DetailsRow key={key}>
                  <strong>{label}</strong>:{' '}
                  <span>
                    {key === 'durationNS' ? (
                      nsFormatter(value)
                    ) : key === 'threads' ? (
                      props.profileGroup.profiles.length
                    ) : key === 'received' ? (
                      <DateTime date={value} />
                    ) : value === undefined || value === '' ? (
                      t('ø')
                    ) : (
                      value
                    )}
                    {key === 'platform' ? (
                      <PlatformIcon size={12} platform={value ?? 'unknown'} />
                    ) : null}
                  </span>
                </DetailsRow>
              );
            })}
            <DetailsRow />
          </DetailsContainer>
        )}
      </ProfileDetails>

      {flamegraphPreferences.layout === 'table left' ||
      flamegraphPreferences.layout === 'table right' ? (
        <ResizableVerticalDrawer>
          {/* The border should be 1px, but we want the actual handler to be wider
          to improve the user experience and not have users have to click on the exact pixel */}
          <InvisibleHandler onMouseDown={props.onResize} />
        </ResizableVerticalDrawer>
      ) : null}
    </FrameDrawer>
  );
});

const nsFormatter = makeFormatter('nanoseconds');

const PROFILE_DETAILS_KEY: Record<string, string> = {
  [t('transaction')]: 'transactionName',
  [t('received at')]: 'received',
  [t('organization')]: 'organizationID',
  [t('project')]: 'projectID',
  [t('platform')]: 'platform',
  [t('environment')]: 'environment',
  [t('version')]: 'version',
  [t('duration')]: 'durationNS',
  [t('threads')]: 'threads',
};

const DEVICE_DETAILS_KEY: Record<string, string> = {
  [t('model')]: 'deviceModel',
  [t('manufacturer')]: 'deviceManufacturer',
  [t('classification')]: 'deviceClassification',
  [t('os')]: 'deviceOSName',
  [t('os version')]: 'deviceOSVersion',
  [t('locale')]: 'deviceLocale',
};

const DetailsRow = styled('div')`
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const DetailsContainer = styled('ul')`
  padding: ${space(1)};
  margin: 0;
  overflow: auto;
  position: absolute;
  left: 0;
  top: 24px;
  width: 100%;
  height: calc(100% - 24px);
`;

const ProfileDetails = styled('div')<{layout: FlamegraphPreferences['layout']}>`
  width: ${p =>
    p.layout === 'table left' || p.layout === 'table right' ? '100%' : '260px'};
  height: ${p =>
    p.layout === 'table left' || p.layout === 'table right' ? '220px' : '100%'};
  border-left: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  grid-area: details;
  position: relative;

  > ul:first-child {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const ResizableVerticalDrawer = styled('div')`
  width: 1px;
  grid-area: drawer;
  background-color: ${p => p.theme.border};
  position: relative;
`;

const InvisibleHandler = styled('div')`
  opacity: 0;
  width: ${space(1)};
  position: absolute;
  inset: 0;
  cursor: ew-resize;
  transform: translateX(-50%);
  background-color: transparent;
`;

const FrameDrawerLabel = styled('label')`
  display: flex;
  align-items: center;
  white-space: nowrap;
  margin-bottom: 0;
  height: 100%;
  font-weight: normal;

  > input {
    margin: 0 ${space(0.5)} 0 0;
  }
`;

// Linter produces a false positive for the grid layout. I did not manage to find out
// how to "fix it" or why it is not working, I imagine it could be due to the ternary?
const FrameDrawer = styled('div')<{layout: FlamegraphPreferences['layout']}>`
  display: grid;
  grid-template-rows: auto 1fr;
  grid-template-columns: ${({layout}) =>
    layout === 'table left' ? '1fr auto' : layout === 'table right' ? 'auto 1fr' : '1fr'};
  /* false positive for grid layout */
  /* stylelint-disable */
  grid-template-areas: ${({layout}) =>
    layout === 'table bottom'
      ? `
    'tabs tabs'
    'table details'
    'drawer drawer'
    `
      : layout === 'table left'
      ? `
      'tabs tabs drawer'
      'table table drawer'
      'details details drawer';
      `
      : `
      'drawer tabs tabs'
      'drawer table table'
      'drawer details details';
      `};
`;
const Separator = styled('li')`
  width: 1px;
  height: 66%;
  margin: 0 ${space(1)};
  background: 1px solid ${p => p.theme.border};
  transform: translateY(29%);
`;

const FrameTabs = styled('ul')`
  display: flex;
  list-style-type: none;
  padding: 0 ${space(1)};
  margin: 0;
  border-top: 1px solid ${prop => prop.theme.border};
  background-color: ${props => props.theme.surface100};
  user-select: none;
  grid-area: tabs;
`;

const ListItem = styled('li')<{margin?: 'none'; size?: 'sm'}>`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-right: ${p => (p.margin === 'none' ? 0 : space(1))};

  button {
    border: none;
    border-top: 2px solid transparent;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    margin: 0;
    padding: ${p => (p.size === 'sm' ? space(0.25) : space(0.5))} 0;
    color: ${p => p.theme.textColor};
    max-height: ${p => (p.size === 'sm' ? '24px' : 'auto')};

    &::after {
      display: block;
      content: attr(data-title);
      font-weight: bold;
      height: 1px;
      color: transparent;
      overflow: hidden;
      visibility: hidden;
      white-space: nowrap;
    }

    &:hover {
      color: ${p => p.theme.textColor};
    }
  }

  &.active button {
    font-weight: bold;
    border-bottom: 2px solid ${prop => prop.theme.active};
  }
`;

const StyledButton = styled(Button)<{active: boolean}>`
  border: none;
  background-color: transparent;
  box-shadow: none;
  transition: none !important;
  opacity: ${p => (p.active ? 0.7 : 0.5)};

  &:not(:last-child) {
    margin-right: ${space(1)};
  }

  &:hover {
    border: none;
    background-color: transparent;
    box-shadow: none;
    opacity: ${p => (p.active ? 0.6 : 0.5)};
  }
`;

const LayoutSelectionContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const FRAME_WEIGHT_CELL_WIDTH_PX = 164;
export const FrameCallersTableCell = styled('div')<{
  isSelected?: boolean;
  noPadding?: boolean;
  textAlign?: React.CSSProperties['textAlign'];
}>`
  width: ${FRAME_WEIGHT_CELL_WIDTH_PX}px;
  position: relative;
  white-space: nowrap;
  flex-shrink: 0;
  padding: 0 ${p => (p.noPadding ? 0 : space(1))} 0 0;
  text-align: ${p => p.textAlign ?? 'initial'};

  &:first-child,
  &:nth-child(2) {
    position: sticky;
    z-index: 1;
    background-color: ${p => (p.isSelected ? p.theme.blue300 : p.theme.background)};
  }

  &:first-child {
    left: 0;
  }
  &:nth-child(2) {
    left: ${FRAME_WEIGHT_CELL_WIDTH_PX}px;
  }

  &:not(:last-child) {
    border-right: 1px solid ${p => p.theme.border};
  }
`;

export {FrameStack};
