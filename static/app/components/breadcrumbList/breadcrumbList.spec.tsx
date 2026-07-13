import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbList} from 'sentry/components/breadcrumbList';

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

/** CSS rule texts (from inserted stylesheets) that target any of `element`'s classes. */
function rulesForElement(element: Element): string[] {
  const classes = (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  return collectCssRules().filter(r => classes.some(c => r.includes(`.${c}`)));
}

/**
 * True when `element` carries the "hide below sm" container-query toggle:
 * a base `display: none` plus an `@container (min-width: 500px) { display: flex }`
 * that reveals it only in wide containers.
 */
function hidesBelowSm(element: Element): boolean {
  const classes = (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  const own = collectCssRules().filter(r => classes.some(c => r.includes(`.${c}`)));
  const hasBaseNone = own.some(
    r => !r.includes('@container') && /display:\s*none/.test(r)
  );
  const revealsAtSm = own.some(
    r => /@container[^{]*min-width:\s*500px/.test(r) && /display:\s*flex/.test(r)
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
          {type: 'link', label: 'Settings', to: '/settings/'},
          {type: 'page-title', label: 'General'},
        ]}
      />
    );

    // Presence check — the list renders (as inline content, not a landmark).
    expect(screen.getByTestId('breadcrumb-list')).toBeInTheDocument();

    const rules = collectCssRules();

    // The list establishes an inline-size query container.
    // (jsdom's getComputedStyle can't read `container-type`, so assert the rule.)
    expect(rules.some(r => /container-type:\s*inline-size/.test(r))).toBe(true);

    // The collapse must be driven by a container query at the xs (500px) breakpoint.
    expect(rules.some(r => /@container[^{]*min-width:\s*500px/.test(r))).toBe(true);

    // Regression guard: the buggy path routed the show/hide toggle through `Flex`,
    // whose display resolver defaulted every unspecified slot to `flex`. That
    // emitted an always-matching `@media (min-width: 0px) { display: flex }` that
    // shadowed the container query and pinned link crumbs visible. It must not exist.
    const alwaysOnMediaFlex = rules.some(
      r => /@media[^{]*min-width:\s*0px/.test(r) && /display:\s*flex/.test(r)
    );
    expect(alwaysOnMediaFlex).toBe(false);
  });

  it('renders the current page as inline text and hides dividers from AT', () => {
    render(
      <BreadcrumbList
        items={[
          {type: 'link', label: 'Settings', to: '/settings/'},
          {type: 'page-title', label: 'General'},
        ]}
      />
    );

    // The current-page crumb renders as inline text, not a heading — the
    // surrounding context (e.g. the TopBar title <h1>) owns the page heading, so
    // the crumb's label must not surface as its own heading.
    expect(screen.getByTestId('breadcrumb-item')).toHaveTextContent('General');
    expect(screen.queryByRole('heading', {name: 'General'})).not.toBeInTheDocument();

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
          {type: 'link', label: 'Settings', to: '/settings/'},
          {
            type: 'select-projects',
            value: 'javascript',
            options: [
              {value: 'javascript', label: 'javascript'},
              {value: 'python', label: 'python'},
            ],
            onChange: () => {},
          },
          {type: 'page-title', label: 'Client Keys'},
        ]}
      />
    );

    // The trigger names both its purpose and the current selection.
    // findBy lets CompactSelect's deferred mount-time state update flush in act.
    expect(
      await screen.findByRole('button', {name: 'Selected Project: javascript'})
    ).toBeInTheDocument();
  });

  it('collapses non-link parents (select-projects) below the xs breakpoint', async () => {
    render(
      <BreadcrumbList
        items={[
          {type: 'link', label: 'Settings', to: '/settings/'},
          {
            type: 'select-projects',
            value: 'javascript',
            options: [
              {value: 'javascript', label: 'javascript'},
              {value: 'python', label: 'python'},
            ],
            onChange: () => {},
          },
          {type: 'page-title', label: 'Client Keys'},
        ]}
      />
    );

    // The <li> wrapping the project picker hides below 500px, same as link crumbs.
    const trigger = await screen.findByRole('button', {
      name: 'Selected Project: javascript',
    });
    const selectItem = trigger.closest('li');
    expect(selectItem).not.toBeNull();
    expect(hidesBelowSm(selectItem!)).toBe(true);

    // The last crumb is not wrapped in a hiding <li> — it always stays visible.
    const current = screen.getByTestId('breadcrumb-item');
    expect(current).toHaveTextContent('Client Keys');
    expect(hidesBelowSm(current.closest('li')!)).toBe(false);
  });

  it('gives crumbs a visible-width floor and never collapses them to 0', () => {
    render(
      <BreadcrumbList
        items={[
          {type: 'link', label: 'Settings', to: '/settings/'},
          {type: 'page-title', label: 'General'},
        ]}
      />
    );

    const link = screen.getByTestId('breadcrumb-link');
    const current = screen.getByTestId('breadcrumb-item');
    const parentLi = link.closest('li')!;

    // The fixed max-width caps are gone, so labels size to content when there's
    // room. (jsdom can't compute layout — this guards the CSS intent, not pixels.)
    expect(rulesForElement(link).some(r => /max-width:\s*132px/.test(r))).toBe(false);
    expect(rulesForElement(current).some(r => /max-width:\s*200px/.test(r))).toBe(false);

    // Regression guard: the parent <li> must not carry min-width:0 — that let it
    // collapse to 0 width when the current page's label was very long.
    expect(rulesForElement(parentLi).join(' ')).not.toContain('min-width: 0');

    // A positive-px min-width floor is emitted so a crumb never shrinks to nothing.
    expect(collectCssRules().some(r => /min-width:\s*[1-9]\d*px/.test(r))).toBe(true);

    // Parents give up width first (high flex-shrink) so the current page truncates last.
    expect(rulesForElement(parentLi).some(r => /flex-shrink:\s*999/.test(r))).toBe(true);
  });
});

describe('BreadcrumbList rich page-title items', () => {
  it('renders a pagination chevron disabled when it has no destination', () => {
    render(
      <BreadcrumbList
        items={[
          {
            type: 'page-title',
            label: 'Issue',
            pagination: {
              previous: {ariaLabel: 'Previous issue', to: '/issues/1/'},
              // No `to` — this is the last item in the list, so it disables.
              next: {ariaLabel: 'Next issue'},
            },
          },
        ]}
      />
    );

    // LinkButton renders role="button" for both link and disabled states.
    expect(screen.getByRole('button', {name: 'Next issue'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByRole('button', {name: 'Previous issue'})).not.toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('renders an always-visible copy trailing action', () => {
    render(
      <BreadcrumbList
        items={[
          {type: 'link', label: 'Issues', to: '/issues/'},
          {
            type: 'page-title',
            label: 'JAVASCRIPT-2X9',
            trailingActions: (
              <BreadcrumbList.CopyAction text="JAVASCRIPT-2X9" label="Copy Short-ID" />
            ),
          },
        ]}
      />
    );

    expect(screen.getByRole('button', {name: 'Copy Short-ID'})).toBeInTheDocument();
  });

  it('drops falsy entries in a trailing-actions array', () => {
    const isPublic = false;
    render(
      <BreadcrumbList
        items={[
          {
            type: 'page-title',
            label: 'JAVASCRIPT-2X9',
            trailingActions: [
              <BreadcrumbList.CopyAction
                key="copy"
                text="JAVASCRIPT-2X9"
                label="Copy Short-ID"
              />,
              isPublic && (
                <BreadcrumbList.MenuAction
                  key="menu"
                  triggerLabel="More actions"
                  items={[]}
                />
              ),
            ],
          },
        ]}
      />
    );

    expect(screen.getByRole('button', {name: 'Copy Short-ID'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'More actions'})).not.toBeInTheDocument();
  });

  it('renders an editable-title as a click-to-edit field', async () => {
    render(
      <BreadcrumbList
        items={[
          {type: 'link', label: 'Dashboards', to: '/dashboards/'},
          {
            type: 'editable-title',
            title: (
              <BreadcrumbList.EditableTitle
                value="My Dashboard"
                onChange={() => {}}
                aria-label="Edit dashboard name"
              />
            ),
          },
        ]}
      />
    );

    // Shows the current title, and clicking it swaps in a labelled textbox.
    const label = screen.getByText('My Dashboard');
    await userEvent.click(label);
    expect(
      screen.getByRole('textbox', {name: 'Edit dashboard name'})
    ).toBeInTheDocument();
  });
});
