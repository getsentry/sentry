import {Fragment, useContext, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import type {AriaTabListOptions} from '@react-aria/tabs';
import {useTabList} from '@react-aria/tabs';
import {useCollection} from '@react-stately/collections';
import {ListCollection} from '@react-stately/list';
import type {TabListStateOptions} from '@react-stately/tabs';
import {useTabListState} from '@react-stately/tabs';
import type {Node} from '@react-types/shared';
import {motion, Reorder} from 'framer-motion';

import {Button} from 'sentry/components/button';
import {TabsContext} from 'sentry/components/tabs';
import {type BaseTabProps, Tab} from 'sentry/components/tabs/tab';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';

import type {DraggableTabListItemProps} from './item';
import {Item} from './item';

interface BaseDraggableTabListProps extends DraggableTabListProps {
  items: DraggableTabListItemProps[];
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
  const tabListRef = useRef<HTMLUListElement>(null);
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

  const {tabListProps} = useTabList({orientation, ...ariaProps}, state, tabListRef);
  useEffect(() => {
    setTabListState(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedItem, state.selectedKey, props.children]);

  // Detect tabs that overflow from the wrapper and put them in an overflow menu
  const tabItemsRef = useRef<Record<string | number, HTMLLIElement | null>>({});

  const persistentTabs = [...state.collection].filter(
    item => item.key !== 'temporary-tab'
  );
  const tempTab = [...state.collection].find(item => item.key === 'temporary-tab');

  return (
    <TabListOuterWrap
      style={outerWrapStyles}
      hideBorder={hideBorder}
      borderStyle={state.selectedKey === 'temporary-tab' ? 'dashed' : 'solid'}
    >
      <Reorder.Group
        axis="x"
        values={[...state.collection]}
        onReorder={onReorder}
        as="div"
        style={{display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'min-content'}}
        layoutRoot
      >
        <TabListWrap {...tabListProps} className={className} ref={tabListRef}>
          {persistentTabs.map(item => (
            <Fragment key={item.key}>
              <Reorder.Item
                key={item.key}
                value={item}
                style={{display: 'flex', flexDirection: 'row'}}
                as="div"
                dragConstraints={tabListRef} // Sets the container that the tabs can be dragged within
                dragElastic={0} // Prevents tabs from being dragged outside of the tab bar
                dragTransition={{bounceStiffness: 400, bounceDamping: 40}} // Recovers spring behavior thats lost when using dragElastic
                layout
              >
                <Tab
                  key={item.key}
                  item={item}
                  state={state}
                  orientation={orientation}
                  overflowing={false}
                  ref={element => (tabItemsRef.current[item.key] = element)}
                  variant={tabVariant}
                />
              </Reorder.Item>
              <TabDivider
                layout
                active={
                  state.selectedKey === 'temporary-tab' ||
                  (state.selectedKey !== item.key &&
                    state.collection.getKeyAfter(item.key) !== state.selectedKey)
                }
              />
            </Fragment>
          ))}
        </TabListWrap>
        <AddViewTempTabWrap>
          <MotionWrapper layout>
            <AddViewButton borderless size="zero" onClick={onAddView}>
              <StyledIconAdd size="xs" />
              {t('Add View')}
            </AddViewButton>
          </MotionWrapper>
          <TabDivider layout active />
          <MotionWrapper layout>
            {tempTab && (
              <Tab
                key={tempTab.key}
                item={tempTab}
                state={state}
                orientation={orientation}
                overflowing={false}
                ref={element => (tabItemsRef.current[tempTab.key] = element)}
                variant={tabVariant}
                borderStyle="dashed"
              />
            )}
          </MotionWrapper>
        </AddViewTempTabWrap>
      </Reorder.Group>
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

const TabDivider = styled(motion.div)<{active: boolean}>`
  ${p =>
    p.active &&
    `
    background-color: ${p.theme.gray200};
    height: 50%;
    width: 1px;
    border-radius: 6px;
    margin-right: ${space(0.5)};
  `}
  margin-top: 1px;
  margin-left: ${space(0.5)};
`;

const TabListOuterWrap = styled('div')<{
  borderStyle: 'dashed' | 'solid';
  hideBorder: boolean;
}>`
  position: relative;
  ${p => !p.hideBorder && `border-bottom: solid 1px ${p.theme.border};`}
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
  position: relative;
  display: grid;
  justify-content: start;
  grid-auto-flow: column;
  padding: 0;
  margin: 0;
  list-style-type: none;
  flex-shrink: 0;
  align-items: center;
`;

const AddViewButton = styled(Button)`
  display: flex;
  color: ${p => p.theme.gray300};
  font-weight: normal;
  padding: ${space(0.5)};
  transform: translateY(1px);
`;

const StyledIconAdd = styled(IconAdd)`
  margin-right: 4px;
`;

const MotionWrapper = styled(motion.div)`
  display: flex;
  position: relative;
`;
