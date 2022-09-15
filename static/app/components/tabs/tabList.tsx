import {useContext, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AriaTabListProps, useTabList} from '@react-aria/tabs';
import {TabListProps as TabListStateProps, useTabListState} from '@react-stately/tabs';
import {Orientation} from '@react-types/shared';

import DropdownButton from 'sentry/components/dropdownButton';
import CompactSelect from 'sentry/components/forms/compactSelect';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import {TabsContext} from './index';
import {Tab} from './tab';

interface TabListProps<T> extends TabListStateProps<T>, AriaTabListProps<T> {
  className?: string;
}

/**
 * To be used as a direct child of the <Tabs /> component. See example usage
 * in tabs.stories.js
 */
export function TabList<T>({className, ...props}: TabListProps<T>) {
  const tabListRef = useRef<HTMLUListElement>(null);
  const [disabledKeys, setDisabledKeys] = useState<React.Key[]>([]);
  const {rootProps, setTabListState} = useContext(TabsContext);
  const {
    orientation,
    disabled,
    disabledKeys: _disabledKeys,
    ...otherRootProps
  } = rootProps;
  const ariaProps = useMemo(
    () => ({
      isDisabled: disabled,
      disabledKeys,
      ...otherRootProps,
      ...props,
    }),
    [disabled, disabledKeys, otherRootProps, props]
  );

  // Load up list state
  const state = useTabListState(ariaProps);
  const {tabListProps} = useTabList({orientation, ...ariaProps}, state, tabListRef);
  useEffect(() => {
    setTabListState(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.disabledKeys, state.selectedItem, state.selectedKey, props.children]);

  // Dynamically update `disabledKeys` when the tabs list is loaded/updated
  useEffect(() => {
    const newDisabledKeys = [...state.collection]
      .filter(item => {
        return item.props.disabled;
      })
      .map(item => item.key);

    setDisabledKeys(newDisabledKeys);
  }, [state.collection]);

  // Detect tabs that overflow from the wrapper and put them in an overflow menu
  const [overflowTabs, setOverflowTabs] = useState<React.Key[]>([]);
  const tabRefs = useRef<Record<string, React.RefObject<HTMLLIElement>>>({});
  useEffect(() => {
    const options = {
      root: tabListRef.current,
      // Nagative right margin to account for overflow menu's trigger button
      rootMargin: `0px -42px 0px ${space(1)}`,
      threshold: 1,
    };

    const callback = entries => {
      entries.forEach(entry => {
        const {target} = entry;
        const {key} = target.dataset;

        if (!entry.isIntersecting) {
          setOverflowTabs(prev => prev.concat([key]));
          return;
        }

        setOverflowTabs(prev => prev.filter(k => k !== key));
      });
    };

    const observer = new IntersectionObserver(callback, options);
    Object.values(tabRefs.current).forEach(
      tabRef => tabRef.current && observer.observe(tabRef.current)
    );

    return () => observer.disconnect();
  }, []);

  const overflowMenuItems = useMemo(() => {
    // Sort overflow items in the order that they appear in TabList
    const sortedKeys = [...state.collection].map(item => item.key);
    const sortedOverflowTabs = overflowTabs.sort(
      (a, b) => sortedKeys.indexOf(a) - sortedKeys.indexOf(b)
    );

    return sortedOverflowTabs.map(key => {
      const item = state.collection.getItem(key);
      return {
        value: key,
        label: item.props.children,
        disabled: item.props.disabled,
      };
    });
  }, [state.collection, overflowTabs]);

  return (
    <TabListOuterWrap className={className}>
      <TabListWrap {...tabListProps} orientation={orientation} ref={tabListRef}>
        {[...state.collection].map(item => (
          <Tab
            key={item.key}
            item={item}
            state={state}
            orientation={orientation}
            setRef={ref => (tabRefs.current[item.key] = ref)}
            overflowing={orientation === 'horizontal' && overflowTabs.includes(item.key)}
          />
        ))}
      </TabListWrap>

      {orientation === 'horizontal' && overflowMenuItems.length > 0 && (
        <CompactSelect
          options={overflowMenuItems}
          value={[...state.selectionManager.selectedKeys][0]}
          onChange={opt => state.setSelectedKey(opt.value)}
          isDisabled={disabled}
          placement="bottom end"
          size="sm"
          offset={4}
          trigger={({props: triggerProps, ref: triggerRef}) => (
            <OverflowMenuTrigger
              ref={triggerRef}
              {...triggerProps}
              borderless
              showChevron={false}
              icon={<IconEllipsis />}
              aria-label={t('More tabs')}
            />
          )}
        />
      )}
    </TabListOuterWrap>
  );
}

const TabListOuterWrap = styled('div')`
  position: relative;
`;

const TabListWrap = styled('ul')<{orientation: Orientation}>`
  position: relative;
  display: grid;
  padding: 0;
  margin: 0;
  list-style-type: none;
  flex-shrink: 0;

  ${p =>
    p.orientation === 'horizontal'
      ? `
        grid-auto-flow: column;
        justify-content: start;
        gap: ${space(2)};
        border-bottom: solid 1px ${p.theme.border};
      `
      : `
        grid-auto-flow: row;
        align-content: start;
        gap: 1px;
        padding-right: ${space(2)};
        border-right: solid 1px ${p.theme.border};
        height: 100%;
      `};
`;

const OverflowMenuTrigger = styled(DropdownButton)`
  position: absolute;
  right: 0;
  bottom: ${space(0.75)};
  padding-left: ${space(1)};
  padding-right: ${space(1)};
`;
