import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbList} from 'sentry/components/breadcrumbs';

function collectCssRules(): string[] {
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(cssRules)) {
      rules.push(rule.cssText);
    }
  }
  return rules;
}

/**
 * True when `element` carries the "hide below sm" container-query toggle:
 * a base `display: none` plus an `@container (min-width: 800px) { display: flex }`
 * that reveals it only in wide containers.
 */
function hidesBelowSm(element: Element): boolean {
  const classes = (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  const own = collectCssRules().filter(r => classes.some(c => r.includes(`.${c}`)));
  const hasBaseNone = own.some(
    r => !r.includes('@container') && /display:\s*none/.test(r)
  );
  const revealsAtSm = own.some(
    r => /@container[^{]*min-width:\s*800px/.test(r) && /display:\s*flex/.test(r)
  );
  return hasBaseNone && revealsAtSm;
}

describe('BreadcrumbList container-query collapse', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    // Known pre-existing issue: the `containerType` prop leaks a `containertype`
    // attribute onto the DOM node, which React warns about. That's a bug in the
    // core Container primitive, unrelated to the collapse behavior under test —
    // tolerate exactly that warning and re-throw anything else.
    consoleError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      // React formats warnings with %s placeholders, so the offending prop name
      // ("containerType") lands in a later arg — check them all.
      if (args.some(arg => typeof arg === 'string' && arg.includes('containerType'))) {
        return;
      }
      throw new Error(`Unexpected console.error: ${args.map(String).join(' ')}`);
    });
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('emits an @container display rule for link crumbs, not an always-on @media shadow', () => {
    render(
      <BreadcrumbList
        items={[
          {type: 'link', props: {label: 'Settings', to: '/settings/'}},
          {type: 'page-title', props: {label: 'General'}},
        ]}
      />
    );

    // Presence check — the nav renders as a labelled landmark.
    expect(screen.getByRole('navigation', {name: 'Breadcrumbs'})).toBeInTheDocument();

    const rules = collectCssRules();

    // The nav establishes an inline-size query container.
    // (jsdom's getComputedStyle can't read `container-type`, so assert the rule.)
    expect(rules.some(r => /container-type:\s*inline-size/.test(r))).toBe(true);

    // The collapse must be driven by a container query at the sm (800px) breakpoint.
    expect(rules.some(r => /@container[^{]*min-width:\s*800px/.test(r))).toBe(true);

    // Regression guard: the buggy path routed the show/hide toggle through `Flex`,
    // whose display resolver defaulted every unspecified slot to `flex`. That
    // emitted an always-matching `@media (min-width: 0px) { display: flex }` that
    // shadowed the container query and pinned link crumbs visible. It must not exist.
    const alwaysOnMediaFlex = rules.some(
      r => /@media[^{]*min-width:\s*0px/.test(r) && /display:\s*flex/.test(r)
    );
    expect(alwaysOnMediaFlex).toBe(false);
  });

  it('marks the current page with aria-current and hides dividers from AT', () => {
    render(
      <BreadcrumbList
        items={[
          {type: 'link', props: {label: 'Settings', to: '/settings/'}},
          {type: 'page-title', props: {label: 'General'}},
        ]}
      />
    );

    // The final crumb is the page's primary heading (<h1>) and signals
    // "you are here" to assistive tech.
    const current = screen.getByRole('heading', {level: 1, name: 'General'});
    expect(current).toHaveAttribute('aria-current', 'page');

    // Parent links must not be marked current.
    expect(screen.getByRole('link', {name: 'Settings'})).not.toHaveAttribute(
      'aria-current'
    );

    // The decorative slash dividers are hidden from the accessibility tree.
    const dividers = document.querySelectorAll('svg[role="img"]:not([aria-hidden])');
    expect(dividers).toHaveLength(0);
  });

  it('gives the select-projects trigger a descriptive accessible name', async () => {
    render(
      <BreadcrumbList
        items={[
          {type: 'link', props: {label: 'Settings', to: '/settings/'}},
          {
            type: 'select-projects',
            props: {
              value: 'javascript',
              options: [
                {value: 'javascript', label: 'javascript'},
                {value: 'python', label: 'python'},
              ],
              onChange: () => {},
            },
          },
          {type: 'page-title', props: {label: 'Client Keys'}},
        ]}
      />
    );

    // The trigger names both its purpose and the current selection.
    // findBy lets CompactSelect's deferred mount-time state update flush in act.
    expect(
      await screen.findByRole('button', {name: 'Selected Project: javascript'})
    ).toBeInTheDocument();
  });

  it('collapses non-link parents (select-projects) below the sm breakpoint', async () => {
    render(
      <BreadcrumbList
        items={[
          {type: 'link', props: {label: 'Settings', to: '/settings/'}},
          {
            type: 'select-projects',
            props: {
              value: 'javascript',
              options: [
                {value: 'javascript', label: 'javascript'},
                {value: 'python', label: 'python'},
              ],
              onChange: () => {},
            },
          },
          {type: 'page-title', props: {label: 'Client Keys'}},
        ]}
      />
    );

    // The <li> wrapping the project picker hides below 800px, same as link crumbs.
    const trigger = await screen.findByRole('button', {
      name: 'Selected Project: javascript',
    });
    const selectItem = trigger.closest('li');
    expect(selectItem).not.toBeNull();
    expect(hidesBelowSm(selectItem!)).toBe(true);

    // The last crumb is not wrapped in a hiding <li> — it always stays visible.
    const current = screen.getByRole('heading', {level: 1, name: 'Client Keys'});
    expect(hidesBelowSm(current.closest('li')!)).toBe(false);
  });
});
