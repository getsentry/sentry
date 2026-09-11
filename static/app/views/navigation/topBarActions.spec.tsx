import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Flex} from '@sentry/scraps/layout';

import {SearchButton} from 'sentry/views/navigation/searchButton';
import {AskSeerButton} from 'sentry/views/seerExplorer/components/askSeerButton';

const theme = ThemeFixture();

function renderActions(width = 0) {
  jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(width);

  return render(
    <Flex containerType="inline-size">
      <SearchButton />
      <AskSeerButton />
    </Flex>,
    {organization: OrganizationFixture()}
  );
}

describe('top bar actions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows tooltips for icon-only actions', async () => {
    renderActions();

    const searchButton = screen.getByRole('button', {name: 'Command Palette'});
    const askSeerButton = screen.getByRole('button', {name: 'Ask Seer'});
    expect(screen.queryByText('Command Palette')).not.toBeInTheDocument();
    expect(screen.queryByText('Ask Seer')).not.toBeInTheDocument();

    await userEvent.hover(searchButton);
    expect(screen.getByText('Command Palette')).toBeInTheDocument();

    await userEvent.hover(askSeerButton);
    expect(screen.getByText('Ask Seer')).toBeInTheDocument();
  });

  it('keeps Command Palette compact and exposes the Ask Seer shortcut in its tooltip at sm', async () => {
    renderActions(Number.parseFloat(theme.container.sm));

    const askSeerButton = screen.getByRole('button', {name: 'Ask Seer'});
    expect(screen.getByRole('button', {name: 'Command Palette'})).toBeInTheDocument();
    expect(screen.queryByText('Command Palette')).not.toBeInTheDocument();
    expect(screen.getByText('Ask Seer')).toBeInTheDocument();
    expect(screen.queryByText('K')).not.toBeInTheDocument();

    await userEvent.hover(askSeerButton);
    expect(screen.getByText('Ctrl', {selector: 'kbd'})).toBeInTheDocument();
    expect(screen.getByText('/', {selector: 'kbd'})).toBeInTheDocument();
  });
});
