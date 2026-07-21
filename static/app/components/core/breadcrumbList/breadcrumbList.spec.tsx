import {Fragment} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

/**
 * True when `element` carries the "hide below sm" container-query toggle:
 * a base `display: none` plus an `@container (min-width: 500px) { display: flex }`
 * that reveals it only in wide containers.
 */
function hidesBelowSm(element: HTMLElement): boolean {
  const own = getEmotionRules(element);
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
      <BreadcrumbList items={[{type: 'link', label: 'Settings', to: '/settings/'}]} />
    );

    // The list renders as an ordered list (as inline content, not a landmark).
    expect(screen.getByRole('list')).toBeInTheDocument();

    const list = screen.getByRole('list');
    const rules = [
      ...getEmotionRules(list.parentElement!),
      ...getEmotionRules(screen.getByRole('link').closest('li')!),
    ];

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

  it('renders title content without a heading and hides dividers from AT', () => {
    render(
      <Fragment>
        <BreadcrumbList items={[{type: 'link', label: 'Settings', to: '/settings/'}]} />
        <BreadcrumbList.Title item={{type: 'page-title', label: 'General'}} />
      </Fragment>
    );

    // TopBar owns the page heading. BreadcrumbList.Title only renders the title
    // content so it can be placed inside that heading without nesting one.
    expect(screen.queryByRole('heading', {name: 'General'})).not.toBeInTheDocument();
    const title = screen.getByText('General');
    expect(title).toBeInTheDocument();
    expect(
      getEmotionRules(title).some(
        rule =>
          rule.includes('overflow: hidden') && rule.includes('text-overflow: ellipsis')
      )
    ).toBe(true);

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
        ]}
      />
    );

    // The trigger names both its purpose and the current selection.
    // findBy lets CompactSelect's deferred mount-time state update flush in act.
    expect(
      await screen.findByRole('button', {
        name: 'Selected Project: javascript',
      })
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
  });

  it('gives crumbs a visible-width floor and never collapses them to 0', () => {
    render(
      <BreadcrumbList items={[{type: 'link', label: 'Settings', to: '/settings/'}]} />
    );

    const link = screen.getByRole('link', {name: 'Settings'});
    const parentLi = link.closest('li')!;

    // The fixed max-width caps are gone, so labels size to content when there's
    // room. (jsdom can't compute layout — this guards the CSS intent, not pixels.)
    expect(getEmotionRules(link).some(r => /max-width:\s*132px/.test(r))).toBe(false);

    // Regression guard: the parent <li> must not carry min-width:0 — that let it
    // collapse to 0 width when the current page's label was very long.
    expect(getEmotionRules(parentLi).join(' ')).not.toContain('min-width: 0');

    // A positive-px min-width floor is emitted so a crumb never shrinks to nothing.
    expect(
      getEmotionRules(link.parentElement!).some(r => /min-width:\s*[1-9]\d*px/.test(r))
    ).toBe(true);

    // Parents give up width first (high flex-shrink) so the current page truncates last.
    expect(getEmotionRules(parentLi).some(r => /flex-shrink:\s*999/.test(r))).toBe(true);
  });
});

describe('BreadcrumbList rich page-title items', () => {
  it('renders a pagination chevron disabled when it has no destination', () => {
    render(
      <BreadcrumbList.Title
        item={{
          type: 'page-title',
          label: 'Issue',
          pagination: {
            previous: {ariaLabel: 'Previous issue', to: '/issues/1/'},
            next: {ariaLabel: 'Next issue'},
          },
        }}
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
      <BreadcrumbList.Title
        item={{
          type: 'page-title',
          label: 'JAVASCRIPT-2X9',
          trailingActions: {
            type: 'copy',
            text: 'JAVASCRIPT-2X9',
            label: 'Copy Short-ID',
          },
        }}
      />
    );

    expect(screen.getByRole('button', {name: 'Copy Short-ID'})).toBeInTheDocument();
  });

  it('renders a menu trailing action', () => {
    render(
      <BreadcrumbList.Title
        item={{
          type: 'page-title',
          label: 'JAVASCRIPT-2X9',
          trailingActions: {
            type: 'menu',
            triggerLabel: 'More actions',
            items: [],
          },
        }}
      />
    );

    expect(screen.getByRole('button', {name: 'More actions'})).toBeInTheDocument();
  });

  it('drops falsy entries in a trailing-actions array', () => {
    const isPublic = false;
    render(
      <BreadcrumbList.Title
        item={{
          type: 'page-title',
          label: 'JAVASCRIPT-2X9',
          trailingActions: [
            {
              type: 'copy',
              text: 'JAVASCRIPT-2X9',
              label: 'Copy Short-ID',
            },
            isPublic
              ? {
                  type: 'menu',
                  triggerLabel: 'More actions',
                  items: [],
                }
              : null,
          ],
        }}
      />
    );

    expect(screen.getByRole('button', {name: 'Copy Short-ID'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'More actions'})).not.toBeInTheDocument();
  });

  it('renders an editable-title as a click-to-edit field', async () => {
    render(
      <BreadcrumbList.Title
        item={{
          type: 'editable-title',
          value: 'My Dashboard',
          onChange: () => {},
          'aria-label': 'Edit dashboard name',
        }}
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
