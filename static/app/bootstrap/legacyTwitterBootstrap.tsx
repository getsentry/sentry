/**
 * This is a re-implementation of some bootstrap functionality that we still
 * depend on in some html templates.
 */

/**
 * Similar to jQuery's `on`, adds an event listener to the root document which
 * will only fire when the selector matches the element which triggered the
 * event.
 */
const addSelectorEventListener = <K extends keyof DocumentEventMap>(
  type: K,
  selector: string,
  listener: (ev: DocumentEventMap[K]) => any
) =>
  document.addEventListener(type, event => {
    const {target} = event;

    if (target === null) {
      return;
    }

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (!target.matches(selector)) {
      return;
    }

    listener(event);
  });

/**
 * Tab toggle handlers.
 *
 * @deprecated
 */
addSelectorEventListener('click', '[data-toggle="tab"]', event => {
  event.preventDefault();

  const triggerElement = event.target as HTMLElement;
  const targetSelector = triggerElement.getAttribute('href');

  if (targetSelector === null) {
    return;
  }

  const targetPanel = document.querySelector<HTMLElement>(targetSelector);

  if (targetPanel === null) {
    return;
  }

  const container = targetPanel.parentElement!;
  const tabs = triggerElement.closest('ul');

  const targetTab = triggerElement.closest('li');
  const lastActiveTab = tabs?.querySelector(':scope > .active');

  // Reset the old active tab
  lastActiveTab?.classList?.remove('active');
  lastActiveTab?.querySelector(':scope > a')?.setAttribute('aria-expanded', 'false');

  container.querySelector<HTMLElement>(':scope > .active')?.classList?.remove('active');

  // Activate the target
  targetTab?.classList.add('active');
  targetTab?.querySelector(':scope > a')?.setAttribute('aria-expanded', 'true');

  targetPanel.classList.add('active');
});

/**
 * Remove alerts when the close button is clicked
 *
 * @deprecated
 */
addSelectorEventListener('click', '[data-dismiss="alert"]', event => {
  (event.target as HTMLElement).closest('.alert')?.remove();
});
