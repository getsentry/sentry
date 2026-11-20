// Based on https://github.com/romgain/react-select-event
// Switched from fireEvent to userEvent to avoid act warnings in react 18

// Copyright 2019 Romain Bertrand
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import {userEvent} from '@testing-library/user-event'; // eslint-disable-line no-restricted-imports

import {waitFor, within, type Matcher} from 'sentry-test/reactTestingLibrary';

function findSelectContainer(input: HTMLElement): HTMLElement | null {
  return input.closest<HTMLElement>('[data-scraps-select]');
}

function getSelectContainer(input: HTMLElement): HTMLElement {
  const container = findSelectContainer(input);
  if (!container) {
    throw new Error('Expected a Scraps Select input');
  }
  return container;
}

function getSelectInput(target: HTMLElement): HTMLElement {
  const container = findSelectContainer(target);
  return container && !target.matches('[role="combobox"]')
    ? within(container).getByRole('combobox')
    : target;
}

type User = ReturnType<typeof userEvent.setup> | typeof userEvent;

type UserEventOptions = {user?: User};

/**
 * Open the select's dropdown menu.
 * @param input The input field (eg. `getByLabelText('The label')`)
 */
const openMenu = async (
  input: HTMLElement,
  {user = userEvent}: UserEventOptions = {}
) => {
  await user.click(getSelectInput(input), {skipHover: true});
};

/**
 * Type text in the input field
 */
const type = async (
  input: HTMLElement,
  text: string,
  {user}: Required<UserEventOptions>
) => {
  await user.type(input, text);
};

/**
 * Press the "clear" button, and reset various states
 */
const clear = async (clearButton: Element, {user}: Required<UserEventOptions>) => {
  await user.click(clearButton, {skipHover: true});
};

interface Config extends UserEventOptions {
  /**
   * A container where the dropdown gets rendered to.
   * Useful when rendering the dropdown in a portal using `menuPortalTarget`.
   * Can be specified as a function if it needs to be lazily evaluated.
   */
  container?: HTMLElement | (() => HTMLElement);
}

/**
 * Utility for selecting a value in a Select dropdown.
 * @param input The input field (eg. `getByLabelText('The label')`)
 * @param optionOrOptions The display name(s) for the option(s) to select
 */
const select = async (
  input: HTMLElement,
  optionOrOptions: Matcher | Matcher[],
  {user = userEvent, ...config}: Config = {}
) => {
  input = getSelectInput(input);
  const options = Array.isArray(optionOrOptions) ? optionOrOptions : [optionOrOptions];

  // Select the items we care about
  for (const option of options) {
    if (input.getAttribute('aria-expanded') !== 'true') {
      await openMenu(input, {user});
    }

    const target = config.container;
    const container =
      typeof target === 'function' ? await waitFor(target) : (target ?? document.body);
    const popup = await waitFor(() => {
      const id = input.getAttribute('aria-controls');
      // eslint-disable-next-line testing-library/no-node-access -- Follow aria-controls to the popup, which may be portaled.
      const element = id && input.ownerDocument.getElementById(id);
      if (!element || !container.contains(element)) {
        throw new Error('Expected an open popup for the Select');
      }
      return element;
    });

    const row = typeof option === 'number' ? String(option) : option;
    const menu = within(popup);
    const matchingOptions = menu.queryAllByRole('option', {name: row});
    const optionElement =
      matchingOptions.at(-1) ?? (await menu.findAllByText(row)).at(-1)!;
    await user.click(optionElement, {skipHover: true});
  }
};

interface CreateConfig extends Config, UserEventOptions {
  /**
   * Custom label for the "create new ..." option in the menu (string or regexp)
   */
  createOptionText?: string | RegExp;
  /**
   * Whether create should wait for new option to be populated in the select container
   */
  waitForElement?: boolean;
}

/**
 * Creates and selects a value in a creatable Select dropdown.
 * @param input The input field (eg. `getByLabelText('The label')`)
 * @param option The display name for the option to type and select
 */
const create = async (
  input: HTMLElement,
  option: string,
  {waitForElement = true, user = userEvent, ...config}: CreateConfig = {}
) => {
  input = getSelectInput(input);
  const createOptionText = config.createOptionText || /^Create "/;
  await openMenu(input, {user});
  await type(input, option, {user});

  await select(input, createOptionText, {...config, user});

  if (waitForElement) {
    await within(getSelectContainer(input)).findByText(option);
  }
};

/**
 * Clears the first value of a `react-select` dropdown.
 * @param input The input field (eg. `getByLabelText('The label')`)
 */
const clearFirst = async (
  input: HTMLElement,
  {user = userEvent}: UserEventOptions = {}
) => {
  const container = getSelectContainer(input);
  const clearButton = within(container).getAllByRole('button', {name: 'Remove item'})[0]!;
  await clear(clearButton, {user});
};

/**
 * Clears all values in a `react-select` dropdown.
 * @param input The input field (eg. `getByLabelText('The label')`)
 */
const clearAll = async (
  input: HTMLElement,
  {user = userEvent}: UserEventOptions = {}
) => {
  const container = getSelectContainer(input);
  await clear(
    within(container).queryByRole('button', {name: 'Clear choices'}) ??
      within(container).getAllByRole('button', {name: 'Remove item'})[0]!,
    {user}
  );
};

export const selectEvent = {select, create, clearFirst, clearAll, openMenu};
