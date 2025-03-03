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

import userEvent from '@testing-library/user-event'; // eslint-disable-line no-restricted-imports

import {type Matcher, waitFor, within} from 'sentry-test/reactTestingLibrary';

/**
 * Find the react-select container from its input field
 */
function getReactSelectContainerFromInput(input: HTMLElement): HTMLElement {
  return input.parentNode!.parentNode!.parentNode!.parentNode!.parentNode as HTMLElement;
}

type User = ReturnType<typeof userEvent.setup> | typeof userEvent;

type UserEventOptions = {
  user?: User;
};

/**
 * Open the select's dropdown menu.
 * @param input The input field (eg. `getByLabelText('The label')`)
 */
const openMenu = async (
  input: HTMLElement,
  {user = userEvent}: UserEventOptions = {}
) => {
  await user.click(input, {skipHover: true});
  // Arrow down may be required?
  // await user.type(input, '{ArrowDown}');
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
   * A container where the react-select dropdown gets rendered to.
   * Useful when rendering the dropdown in a portal using `menuPortalTarget`.
   * Can be specified as a function if it needs to be lazily evaluated.
   */
  container?: HTMLElement | (() => HTMLElement);
}

/**
 * Utility for selecting a value in a `react-select` dropdown.
 * @param input The input field (eg. `getByLabelText('The label')`)
 * @param optionOrOptions The display name(s) for the option(s) to select
 */
const select = async (
  input: HTMLElement,
  optionOrOptions: Matcher | Matcher[],
  {user = userEvent, ...config}: Config = {}
) => {
  const options = Array.isArray(optionOrOptions) ? optionOrOptions : [optionOrOptions];

  // Select the items we care about
  for (const option of options) {
    await openMenu(input, {user});

    let container: HTMLElement;
    if (typeof config.container === 'function') {
      // when specified as a function, the container needs to be lazily evaluated, so
      // we have to wait for it to be visible:
      await waitFor(config.container);
      container = config.container();
    } else if (config.container) {
      container = config.container;
    } else {
      container = getReactSelectContainerFromInput(input);
    }

    // only consider visible, interactive elements
    const matchingElements = await within(container).findAllByText(option, {
      ignore: "[aria-live] *,[style*='visibility: hidden']",
    });

    // When the target option is already selected, the react-select display text
    // will also match the selector. In this case, the actual dropdown element is
    // positioned last in the DOM tree.
    const optionElement = matchingElements[matchingElements.length - 1]!;
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
 * Creates and selects a value in a Creatable `react-select` dropdown.
 * @param input The input field (eg. `getByLabelText('The label')`)
 * @param option The display name for the option to type and select
 */
const create = async (
  input: HTMLElement,
  option: string,
  {waitForElement = true, user = userEvent, ...config}: CreateConfig = {}
) => {
  const createOptionText = config.createOptionText || /^Create "/;
  await openMenu(input, {user});
  await type(input, option, {user});

  await select(input, createOptionText, {...config, user});

  if (waitForElement) {
    await within(getReactSelectContainerFromInput(input)).findByText(option);
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
  const container = getReactSelectContainerFromInput(input);
  // The "clear" button is the first svg element that is hidden to screen readers
  // eslint-disable-next-line testing-library/no-node-access
  const clearButton = container.querySelector('svg[aria-hidden="true"]')!;
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
  const container = getReactSelectContainerFromInput(input);
  // The "clear all" button is the penultimate svg element that is hidden to screen readers
  // (the last one is the dropdown arrow)
  // eslint-disable-next-line testing-library/no-node-access
  const elements = container.querySelectorAll('svg[aria-hidden="true"]');
  const clearAllButton = elements[elements.length - 2]!;
  await clear(clearAllButton, {user});
};

const selectEvent = {select, create, clearFirst, clearAll, openMenu};
export default selectEvent;
