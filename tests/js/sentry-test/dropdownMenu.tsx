import {act} from 'react-dom/test-utils';
import {ReactWrapper} from 'enzyme'; // eslint-disable-line no-restricted-imports

import {triggerPress} from 'sentry-test/utils';

type SelectDropdownItemProps = {
  /**
   * They key(s) of menu item(s) to select. If the item is nested inside a
   * sub-menu, then this must be an array containing the keys of ancestor
   * items, with the highest-level item first, and the last item to select
   * last.
   */
  itemKey: string | string[];
  /**
   * The root node wrapper, must be provided to run wrapper.update() after
   * each step.
   */
  wrapper: ReactWrapper;
  /**
   * Optional arguments to help the function better locate the dropdown
   * control. Useful if there are more than one control inside `wrapper`. If
   * provided, before each selection, the function will first call
   * wrapper.find([prefix])[.first()/.last()/.at([at])]
   */
  specifiers?: {
    prefix: string;
    at?: number;
    first?: boolean;
    last?: boolean;
  };
  /**
   * Selector for the dropdown's trigger button, useful for custom trigger
   * components whose display name is different from 'TriggerButton'.
   */
  triggerSelector?: string;
};

/**
 * Select a dropdown menu item. This function works for both top-level and
 * nested items.
 */
export async function selectDropdownMenuItem({
  wrapper,
  itemKey,
  specifiers,
  triggerSelector = 'DropdownTrigger',
}: SelectDropdownItemProps) {
  /**
   * Returns a ReactWrapper which we'll use to find the
   * dropdown menu control. If `specifiers` is not provided, returns the root
   * wrapper by default.
   */
  function getSpecifiedWrap(): ReactWrapper {
    if (!specifiers) {
      return wrapper;
    }
    const prefixedWrap = wrapper.find(specifiers.prefix);

    if (specifiers.first) {
      return prefixedWrap.first();
    }
    if (specifiers.last) {
      return prefixedWrap.last();
    }
    if (typeof specifiers.at === 'number') {
      return prefixedWrap.at(specifiers.at);
    }
    return prefixedWrap;
  }

  // Open the top-level dropdown menu
  await act(async () => {
    triggerPress(getSpecifiedWrap().find(triggerSelector));

    await tick();
    wrapper.update();
  });

  // Select menu item(s) via itemKey
  await act(async () => {
    const keys = Array.isArray(itemKey) ? itemKey : [itemKey];

    for (const key of keys) {
      triggerPress(
        getSpecifiedWrap().find(`MenuWrap MenuItemWrap[data-test-id="${key}"]`)
      );

      await tick();
      wrapper.update();
    }
  });
}
