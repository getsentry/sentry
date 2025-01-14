import {
  type Dispatch,
  Fragment,
  type Key,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {AriaTabListOptions} from '@react-aria/tabs';
import {useTabList} from '@react-aria/tabs';
import {useCollection} from '@react-stately/collections';
import {ListCollection} from '@react-stately/list';
import type {TabListState, TabListStateOptions} from '@react-stately/tabs';
import {useTabListState} from '@react-stately/tabs';
import type {Node} from '@react-types/shared';
import {motion, Reorder} from 'framer-motion';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import {type BaseTabProps, Tab} from 'sentry/components/tabs/tab';
import {IconAdd, IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useDimensionsMultiple} from 'sentry/utils/useDimensionsMultiple';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {IssueViewsContext} from 'sentry/views/issueList/issueViews/issueViews';

import type {DraggableTabListItemProps} from './item';
import {Item} from './item';

export const TEMPORARY_TAB_KEY = 'temporary-tab';

interface BaseDraggableTabListProps extends DraggableTabListProps {
  items: DraggableTabListItemProps[];
}

function useOverflowingTabs({state}: {state: TabListState<DraggableTabListItemProps>}) {
  const persistentTabs = [...state.collection].filter(
    item => item.key !== TEMPORARY_TAB_KEY
  );
  const outerRef = useRef<HTMLDivElement>(null);
  const addViewTempTabRef = useRef<HTMLDivElement>(null);
  const [tabElements, setTabElements] = useState<Array<HTMLDivElement | null>>([]);
  const {width: outerWidth} = useDimensions({elementRef: outerRef});
  const {width: addViewTempTabWidth} = useDimensions({elementRef: addViewTempTabRef});
  const tabsDimensions = useDimensionsMultiple({elements: tabElements});

  const overflowingTabs = useMemo(() => {
    const availableWidth = outerWidth - addViewTempTabWidth;

    let totalWidth = 0;
    const overflowing: Node<DraggableTabListItemProps>[] = [];

    for (let i = 0; i < tabsDimensions.length; i++) {
      totalWidth += tabsDimensions[i]!.width + 1; // 1 extra pixel for the divider
      if (totalWidth > availableWidth + 1) {
        overflowing.push(persistentTabs[i]!);
      }
    }

    return overflowing.filter(defined);
  }, [outerWidth, addViewTempTabWidth, persistentTabs, tabsDimensions]);

  return {
    overflowingTabs,
    setTabElements,
    outerRef,
    addViewTempTabRef,
    persistentTabs,
  };
}

function OverflowMenu({
  state,
  overflowTabs,
}: {
  overflowTabs: Node<DraggableTabListItemProps>[];
  state: TabListState<any>;
}) {
  const options = useMemo(() => {
    return overflowTabs.map(tab => {
      return {
        value: tab.key,
        label: tab.textValue,
        textValue: tab.textValue,
      };
    });
  }, [overflowTabs]);

  return (
    <CompactSelect
      options={options}
      multiple={false}
      value={state.selectionManager.firstSelectedKey?.toString()}
      onChange={opt => state.setSelectedKey(opt.value)}
      position="bottom-end"
      size="sm"
      offset={4}
      trigger={triggerProps => (
        <OverflowMenuTrigger
          {...triggerProps}
          size="sm"
          borderless
          showChevron={false}
          icon={<IconEllipsis />}
          aria-label={t('More tabs')}
        />
      )}
    />
  );
}

function Tabs({
  orientation,
  ariaProps,
  state,
  className,
  onReorder,
  onReorderComplete,
  tabVariant,
  setTabRefs,
  tabs,
  overflowingTabs,
  hoveringKey,
  setHoveringKey,
  tempTabActive,
  editingTabKey,
}: {
  ariaProps: AriaTabListOptions<DraggableTabListItemProps>;
  hoveringKey: Key | 'addView' | null;
  onReorder: (newOrder: Node<DraggableTabListItemProps>[]) => void;
  orientation: 'horizontal' | 'vertical';
  overflowingTabs: Node<DraggableTabListItemProps>[];
  setHoveringKey: (key: Key | 'addView' | null) => void;
  setTabRefs: Dispatch<SetStateAction<Array<HTMLDivElement | null>>>;
  state: TabListState<DraggableTabListItemProps>;
  tabs: Node<DraggableTabListItemProps>[];
  tempTabActive: boolean;
  className?: string;
  disabled?: boolean;
  editingTabKey?: string;
  onChange?: (key: string | number) => void;
  onReorderComplete?: () => void;
  tabVariant?: BaseTabProps['variant'];
  value?: string | number;
}) {
  const tabListRef = useRef<HTMLDivElement>(null);
  const {tabListProps} = useTabList({orientation, ...ariaProps}, state, tabListRef);

  const values = useMemo(() => [...state.collection], [state.collection]);

  const [isDragging, setIsDragging] = useState(false);

  // Only apply this while dragging, because it causes tabs to stay within the container
  // which we do not want (we hide tabs once they overflow
  const dragConstraints = isDragging ? tabListRef : undefined;

  const isTabDividerVisible = tabKey => {
    // If the tab divider is succeeding or preceding the selected tab key
    if (
      state.selectedKey === tabKey ||
      (state.selectedKey !== TEMPORARY_TAB_KEY &&
        state.collection.getKeyAfter(tabKey) !== TEMPORARY_TAB_KEY &&
        state.collection.getKeyAfter(tabKey) === state.selectedKey)
    ) {
      return false;
    }

    // If the tab divider is succeeding or preceding the hovering tab key
    if (
      hoveringKey !== TEMPORARY_TAB_KEY &&
      (hoveringKey === tabKey || hoveringKey === state.collection.getKeyAfter(tabKey))
    ) {
      return false;
    }

    if (
      tempTabActive &&
      state.collection.getKeyAfter(tabKey) === TEMPORARY_TAB_KEY &&
      hoveringKey === 'addView'
    ) {
      return false;
    }

    if (
      tabKey !== TEMPORARY_TAB_KEY &&
      !state.collection.getKeyAfter(tabKey) &&
      hoveringKey === 'addView'
    ) {
      return false;
    }

    return true;
  };

  return (
    <TabListWrap {...tabListProps} className={className} ref={tabListRef}>
      <ReorderGroup axis="x" values={values} onReorder={onReorder} initial={false}>
        {tabs.map((item, i) => (
          <Fragment key={item.key}>
            <TabItemWrap
              isSelected={state.selectedKey === item.key}
              ref={el =>
                setTabRefs(old => {
                  if (!el || old.includes(el)) {
                    return old;
                  }

                  const newRefs = [...old];
                  newRefs[i] = el;
                  return newRefs;
                })
              }
              value={item}
              data-key={item.key}
              dragConstraints={dragConstraints} // dragConstraints are the bounds that the tab can be dragged within
              dragElastic={0} // Prevents the tab from being dragged outside of the dragConstraints (w/o this you can drag it outside but it'll spring back)
              dragTransition={{bounceStiffness: 400, bounceDamping: 40}} // Recovers spring behavior thats lost when using dragElastic=0
              transition={{duration: 0.1}}
              layout
              drag={item.key !== editingTabKey} // Disable dragging if the tab is being edited
              onDrag={() => setIsDragging(true)}
              onDragEnd={() => {
                setIsDragging(false);
                onReorderComplete?.();
              }}
              onHoverStart={() => setHoveringKey(item.key)}
              onHoverEnd={() => setHoveringKey(null)}
              initial={false}
            >
              <Tab
                key={item.key}
                item={item}
                state={state}
                orientation={orientation}
                overflowing={overflowingTabs.some(tab => tab.key === item.key)}
                variant={tabVariant}
                as="div"
              />
            </TabItemWrap>
            <TabDivider
              layout="position"
              transition={{duration: 0.1}}
              isVisible={isTabDividerVisible(item.key)}
              initial={false}
            />
          </Fragment>
        ))}
      </ReorderGroup>
    </TabListWrap>
  );
}

function BaseDraggableTabList({
  hideBorder = false,
  className,
  outerWrapStyles,
  onReorder,
  onReorderComplete,
  onAddView,
  tabVariant = 'filled',
  ...props
}: BaseDraggableTabListProps) {
  const navigate = useNavigate();
  const [hoveringKey, setHoveringKey] = useState<Key | null>(null);
  const {rootProps, setTabListState} = useContext(IssueViewsContext);
  const organization = useOrganization();
  const {
    value,
    defaultValue,
    onChange,
    disabled,
    orientation = 'horizontal',
    keyboardActivation = 'manual',
    ...otherRootProps
  } = rootProps;

  // Load up list state
  const ariaProps = {
    selectedKey: value,
    defaultSelectedKey: defaultValue,
    onSelectionChange: key => {
      onChange?.(key);

      // If the newly selected tab is a tab link, then navigate to the specified link
      const linkTo = [...(props.items ?? [])].find(item => item.key === key)?.to;
      if (!linkTo) {
        return;
      }

      trackAnalytics('issue_views.switched_views', {
        organization,
      });

      navigate(linkTo);
    },
    isDisabled: disabled,
    keyboardActivation,
    ...otherRootProps,
    ...props,
  };

  const state = useTabListState(ariaProps);
  useEffect(() => {
    setTabListState(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedKey]);

  const tempTab = [...state.collection].find(item => item.key === TEMPORARY_TAB_KEY);

  const {outerRef, setTabElements, persistentTabs, overflowingTabs, addViewTempTabRef} =
    useOverflowingTabs({state});

  return (
    <TabListOuterWrap
      style={outerWrapStyles}
      hideBorder={hideBorder}
      borderStyle={state.selectedKey === TEMPORARY_TAB_KEY ? 'dashed' : 'solid'}
      ref={outerRef}
    >
      <Tabs
        orientation={orientation}
        ariaProps={ariaProps}
        state={state}
        className={className}
        onReorder={onReorder}
        onReorderComplete={onReorderComplete}
        tabVariant={tabVariant}
        setTabRefs={setTabElements}
        tabs={persistentTabs}
        overflowingTabs={overflowingTabs}
        hoveringKey={hoveringKey}
        setHoveringKey={setHoveringKey}
        tempTabActive={!!tempTab}
        editingTabKey={props.editingTabKey}
      />
      <AddViewTempTabWrap ref={addViewTempTabRef}>
        <AddViewMotionWrapper
          onHoverStart={() => setHoveringKey('addView')}
          onHoverEnd={() => setHoveringKey(null)}
        >
          <AddViewButton
            borderless
            size="zero"
            onClick={onAddView}
            analyticsEventName="Issue Views: Add View Clicked"
            analyticsEventKey="issue_views.add_view.clicked"
          >
            <StyledIconAdd size="xs" />
            {t('Add View')}
          </AddViewButton>
        </AddViewMotionWrapper>
        <TabDivider
          layout="position"
          isVisible={
            defined(tempTab) &&
            state?.selectedKey !== TEMPORARY_TAB_KEY &&
            hoveringKey !== 'addView' &&
            hoveringKey !== TEMPORARY_TAB_KEY
          }
        />
        <MotionWrapper
          onHoverStart={() => setHoveringKey(TEMPORARY_TAB_KEY)}
          onHoverEnd={() => setHoveringKey(null)}
        >
          {tempTab && (
            <TempTabWrap>
              <Tab
                key={TEMPORARY_TAB_KEY}
                item={tempTab}
                state={state}
                orientation={orientation}
                overflowing={false}
                variant={tabVariant}
                borderStyle="dashed"
              />
            </TempTabWrap>
          )}
        </MotionWrapper>
        {overflowingTabs.length > 0 ? (
          <OverflowMenu state={state} overflowTabs={overflowingTabs} />
        ) : null}
      </AddViewTempTabWrap>
    </TabListOuterWrap>
  );
}

const collectionFactory = (nodes: Iterable<Node<any>>) => new ListCollection(nodes);

export interface DraggableTabListProps
  extends AriaTabListOptions<DraggableTabListItemProps>,
    TabListStateOptions<DraggableTabListItemProps> {
  onReorder: (newOrder: Node<DraggableTabListItemProps>[]) => void;
  className?: string;
  editingTabKey?: string;
  hideBorder?: boolean;
  onAddView?: React.MouseEventHandler;
  onReorderComplete?: () => void;
  outerWrapStyles?: React.CSSProperties;
  showTempTab?: boolean;
  tabVariant?: BaseTabProps['variant'];
}

/**
 * To be used as a direct child of the <Tabs /> component. See example usage
 * in tabs.stories.js
 */
export function DraggableTabList({items, onAddView, ...props}: DraggableTabListProps) {
  const collection = useCollection({items, ...props}, collectionFactory);

  const parsedItems = useMemo(
    () => [...collection].map(({key, props: itemProps}) => ({key, ...itemProps})),
    [collection]
  );

  /**
   * List of keys of disabled items (those with a `disbled` prop) to be passed
   * into `BaseTabList`.
   */
  const disabledKeys = useMemo(
    () => parsedItems.filter(item => item.disabled).map(item => item.key),
    [parsedItems]
  );

  return (
    <BaseDraggableTabList
      items={parsedItems}
      onAddView={onAddView}
      disabledKeys={disabledKeys}
      {...props}
    >
      {item => <Item {...item} key={item.key} />}
    </BaseDraggableTabList>
  );
}

DraggableTabList.Item = Item;

const TabItemWrap = styled(Reorder.Item, {
  shouldForwardProp: prop => prop !== 'isSelected',
})<{isSelected: boolean}>`
  display: flex;
  position: relative;
  z-index: ${p => (p.isSelected ? 1 : 0)};
`;

const TempTabWrap = styled('div')`
  display: flex;
  position: relative;
  line-height: 1.6;
`;

/**
 * TabDividers are only visible around NON-selected tabs. They are not visible around the selected tab,
 * but they still create some space and act as a gap between tabs.
 */
const TabDivider = styled(motion.div, {
  shouldForwardProp: prop => prop !== 'isVisible',
})<{isVisible: boolean}>`
  ${p =>
    p.isVisible &&
    css`
      background-color: ${p.theme.gray200};
      height: 16px;
      width: 1px;
      border-radius: 6px;
    `}

  ${p => !p.isVisible && `margin-left: 1px;`}

  margin-top: 1px;
`;

const TabListOuterWrap = styled('div')<{
  borderStyle: 'dashed' | 'solid';
  hideBorder: boolean;
}>`
  position: relative;
  ${p => !p.hideBorder && `border-bottom: solid 1px ${p.theme.border};`}
  display: grid;
  grid-template-columns: minmax(auto, max-content) minmax(max-content, 1fr);
  bottom: -1px;
`;

const AddViewTempTabWrap = styled('div')`
  position: relative;
  display: grid;
  padding: 0;
  margin: 0;
  list-style-type: none;
  flex-shrink: 0;
  grid-auto-flow: column;
  justify-content: start;
  align-items: center;
`;

const TabListWrap = styled('div')`
  padding: 0;
  margin: 0;
  list-style-type: none;
  overflow-x: hidden;
`;

const ReorderGroup = styled(Reorder.Group<Node<DraggableTabListItemProps>>)`
  display: flex;
  align-items: center;
  overflow: hidden;
  width: max-content;
  position: relative;
  margin: 0;
  padding: 0;
  list-style-type: none;
`;

const AddViewButton = styled(Button)`
  display: flex;
  color: ${p => p.theme.gray300};
  font-weight: normal;
  border-radius: ${p => `${p.theme.borderRadius} ${p.theme.borderRadius} 0 0`};
  padding: ${space(1)} ${space(1)};
  height: 31px;
  line-height: 1.4;
`;

const StyledIconAdd = styled(IconAdd)`
  margin-right: 4px;
`;

const MotionWrapper = styled(motion.div)`
  display: flex;
  position: relative;
  bottom: 1px;
`;

const AddViewMotionWrapper = styled(motion.div)`
  display: flex;
  position: relative;
  margin-top: ${space(0.25)};
`;

const OverflowMenuTrigger = styled(DropdownButton)`
  padding: ${space(0.5)} ${space(0.75)};
  border: none;

  & > span {
    height: 26px;
  }
`;
