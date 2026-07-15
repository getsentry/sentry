import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import {TopBar} from './topBar';

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

function renderTopBar() {
  render(
    <TopBar.Slot.Provider>
      <TopBar />
      <TopBar.Slot name="title">Page title</TopBar.Slot>
    </TopBar.Slot.Provider>,
    {organization: OrganizationFixture()}
  );
}

describe('TopBar title slot', () => {
  it('renders the title as an h1 by default', () => {
    renderTopBar();

    expect(
      screen.getByRole('heading', {name: 'Page title', level: 1})
    ).toBeInTheDocument();
  });

  it('renders breadcrumbs before the title', () => {
    render(
      <TopBar.Slot.Provider>
        <TopBar />
        <TopBar.Slot name="breadcrumbs">
          <BreadcrumbList
            items={[{type: 'link', label: 'Parent page', to: '/parent/'}]}
          />
        </TopBar.Slot>
        <TopBar.Slot name="title">Page title</TopBar.Slot>
      </TopBar.Slot.Provider>,
      {organization: OrganizationFixture()}
    );

    const breadcrumbs = screen.getByRole('link', {name: 'Parent page'});
    const title = screen.getByRole('heading', {name: 'Page title', level: 1});
    expect(
      Boolean(
        breadcrumbs.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);

    const breadcrumbList = screen.getByRole('list');
    const breadcrumbSlot = breadcrumbList.parentElement?.parentElement?.parentElement;
    expect(breadcrumbSlot).not.toBeNull();

    const classes = (breadcrumbSlot?.getAttribute('class') ?? '')
      .split(/\s+/)
      .filter(Boolean);
    expect(
      collectCssRules().some(
        rule =>
          classes.some(className => rule.includes(`.${className}`)) &&
          /flex:\s*0 1 auto/.test(rule)
      )
    ).toBe(true);

    const queryContainer = breadcrumbList.parentElement;
    const queryContainerClasses = (queryContainer?.getAttribute('class') ?? '')
      .split(/\s+/)
      .filter(Boolean);
    expect(
      collectCssRules().some(
        rule =>
          queryContainerClasses.some(className => rule.includes(`.${className}`)) &&
          /container-type:\s*normal/.test(rule)
      )
    ).toBe(true);
  });

  it('keeps BreadcrumbList titles inside the single TopBar heading', () => {
    render(
      <TopBar.Slot.Provider>
        <TopBar />
        <TopBar.Slot name="breadcrumbs">
          <BreadcrumbList items={[{type: 'link', label: 'Issues', to: '/issues/'}]} />
        </TopBar.Slot>
        <TopBar.Slot name="title">
          <BreadcrumbList.Title item={{type: 'page-title', label: 'Current Issue'}} />
        </TopBar.Slot>
      </TopBar.Slot.Provider>,
      {organization: OrganizationFixture()}
    );

    expect(within(screen.getByRole('banner')).getAllByRole('heading')).toHaveLength(1);
    expect(
      screen.getByRole('heading', {name: 'Current Issue', level: 1})
    ).toBeInTheDocument();
  });
});
