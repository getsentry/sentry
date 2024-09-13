import {
  type Dispatch,
  Fragment,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import {TabsContext} from 'sentry/components/tabs';
import {type BaseTabProps, Tab} from 'sentry/components/tabs/tab';
import {IconAdd, IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useDimensionsMultiple} from 'sentry/utils/useDimensionsMultiple';

import type {DraggableTabListItemProps} from './item';
import {Item} from './item';

interface BaseDraggableTabListProps extends DraggableTabListProps {
  items: DraggableTabListItemProps[];
}

function useOverflowingTabs({state}: {state: TabListState<DraggableTabListItemProps>}) {
  const persistentTabs = [...state.collection].filter(
    item => item.key !== 'temporary-tab'
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
      totalWidth += tabsDimensions[i].width + 1; // 1 extra pixel for the divider
      if (totalWidth > availableWidth + 1) {
        overflowing.push(persistentTabs[i]);
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
  tabVariant,
  setTabRefs,
  tabs,
  overflowingTabs,
}: {
  ariaProps: AriaTabListOptions<DraggableTabListItemProps>;
  onReorder: (newOrder: Node<DraggableTabListItemProps>[]) => void;
  orientation: 'horizontal' | 'vertical';
  overflowingTabs: Node<DraggableTabListItemProps>[];
  setTabRefs: Dispatch<SetStateAction<Array<HTMLDivElement | null>>>;
  state: TabListState<DraggableTabListItemProps>;
  tabs: Node<DraggableTabListItemProps>[];
  className?: string;
  disabled?: boolean;
  onChange?: (key: string | number) => void;
  tabVariant?: BaseTabProps['variant'];
  value?: string | number;
}) {
  const tabListRef = useRef<HTMLUListElement>(null);
  const {tabListProps} = useTabList({orientation, ...ariaProps}, state, tabListRef);

  const values = useMemo(() => [...state.collection], [state.collection]);

  const [isDragging, setIsDragging] = useState(false);

  // Only apply this while dragging, because it causes tabs to stay within the container
  // which we do not want (we hide tabs once they overflow
  const dragConstraints = isDragging ? tabListRef : undefined;

  return (
    <TabListWrap {...tabListProps} className={className} ref={tabListRef}>
      <ReorderGroup axis="x" values={values} onReorder={onReorder} as="div">
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
              as="div"
              data-key={item.key}
              dragConstraints={dragConstraints} // dragConstraints are the bounds that the tab can be dragged within
              dragElastic={0} // Prevents the tab from being dragged outside of the dragConstraints (w/o this you can drag it outside but it'll spring back)
              dragTransition={{bounceStiffness: 400, bounceDamping: 40}} // Recovers spring behavior thats lost when using dragElastic=0
              transition={{delay: -0.1}} // Skips the first few frames of the animation that make the tab appear to shrink before growing
              layout
              onDrag={() => setIsDragging(true)}
              onDragEnd={() => setIsDragging(false)}
            >
              <div key={item.key}>
                <Tab
                  key={item.key}
                  item={item}
                  state={state}
                  orientation={orientation}
                  overflowing={overflowingTabs.some(tab => tab.key === item.key)}
                  variant={tabVariant}
                />
              </div>
            </TabItemWrap>
            <TabDivider
              isVisible={
                state.selectedKey === 'temporary-tab' ||
                (state.selectedKey !== item.key &&
                  state.collection.getKeyAfter(item.key) !== state.selectedKey)
              }
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
  onAddView,
  tabVariant = 'filled',
  ...props
}: BaseDraggableTabListProps) {
  const {rootProps, setTabListState} = useContext(TabsContext);
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
      browserHistory.push(linkTo);
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

  const tempTab = [...state.collection].find(item => item.key === 'temporary-tab');

  const {outerRef, setTabElements, persistentTabs, overflowingTabs, addViewTempTabRef} =
    useOverflowingTabs({state});

  return (
    <TabListOuterWrap
      style={outerWrapStyles}
      hideBorder={hideBorder}
      borderStyle={state.selectedKey === 'temporary-tab' ? 'dashed' : 'solid'}
      ref={outerRef}
    >
      <Tabs
        orientation={orientation}
        ariaProps={ariaProps}
        state={state}
        className={className}
        onReorder={onReorder}
        tabVariant={tabVariant}
        setTabRefs={setTabElements}
        tabs={persistentTabs}
        overflowingTabs={overflowingTabs}
      />
      <AddViewTempTabWrap ref={addViewTempTabRef}>
        <MotionWrapper>
          <AddViewButton borderless size="zero" onClick={onAddView}>
            <StyledIconAdd size="xs" />
            {t('Add View')}
          </AddViewButton>
        </MotionWrapper>
        <MotionWrapper>
          {tempTab && (
            <Tab
              key={tempTab.key}
              item={tempTab}
              state={state}
              orientation={orientation}
              overflowing={false}
              variant={tabVariant}
              borderStyle="dashed"
            />
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
  hideBorder?: boolean;
  onAddView?: React.MouseEventHandler;
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
      {item => <Item {...item} />}
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

/**
 * TabDividers are only visible around NON-selected tabs. They are not visible around the selected tab,
 * but they still create some space and act as a gap between tabs.
 */
const TabDivider = styled(motion.div, {
  shouldForwardProp: prop => prop !== 'isVisible',
})<{isVisible: boolean}>`
  ${p =>
    p.isVisible &&
    `
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

const TabListWrap = styled('ul')`
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
`;

const AddViewButton = styled(Button)`
  display: flex;
  color: ${p => p.theme.gray300};
  font-weight: normal;
  padding: ${space(0.5)};
  margin-right: ${space(0.5)};
`;

const StyledIconAdd = styled(IconAdd)`
  margin-right: 4px;
`;

const MotionWrapper = styled(motion.div)`
  display: flex;
  position: relative;
`;

const OverflowMenuTrigger = styled(DropdownButton)`
  padding-left: ${space(1)};
  padding-right: ${space(1)};
`;
