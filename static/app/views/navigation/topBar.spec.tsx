import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TopBar} from './topBar';

function renderTopBar(titleProps: {as?: 'div'}) {
  render(
    <TopBar.Slot.Provider>
      <TopBar />
      <TopBar.Slot name="title" {...titleProps}>
        Page title
      </TopBar.Slot>
    </TopBar.Slot.Provider>,
    {organization: OrganizationFixture()}
  );
}

describe('TopBar title slot', () => {
  it('renders the title as an h1 by default', () => {
    renderTopBar({});

    expect(screen.getByText('Page title')).toHaveProperty('tagName', 'H1');
  });

  it('supports rendering the title as a div', () => {
    renderTopBar({as: 'div'});

    expect(screen.getByText('Page title')).toHaveProperty('tagName', 'DIV');
  });
});
