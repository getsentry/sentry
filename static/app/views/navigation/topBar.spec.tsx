import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import {TopBar} from './topBar';

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

  it('hides the empty breadcrumbs outlet when only the title slot is used', () => {
    renderTopBar();

    const emptyBreadcrumbsOutlet = Array.from(
      screen.getByRole('banner').querySelectorAll<HTMLElement>('*')
    ).find(element =>
      getEmotionRules(element).some(
        rule => /display:\s*none/.test(rule) && /flex:\s*0 1 auto/.test(rule)
      )
    );

    expect(emptyBreadcrumbsOutlet).toBeDefined();
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
