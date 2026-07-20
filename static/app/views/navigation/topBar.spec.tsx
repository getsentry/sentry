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

    expect(
      getEmotionRules(breadcrumbSlot!).some(rule => /flex:\s*0 1 auto/.test(rule))
    ).toBe(true);

    const queryContainer = breadcrumbList.parentElement;
    expect(
      getEmotionRules(queryContainer!).some(rule => /container-type:\s*normal/.test(rule))
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
