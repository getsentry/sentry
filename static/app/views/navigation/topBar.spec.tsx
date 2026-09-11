import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Flex} from '@sentry/scraps/layout';

import {TopBar} from './topBar';

const theme = ThemeFixture();

jest.mock('sentry/utils/useFeedbackForm', () => ({
  useFeedbackForm: () => jest.fn(),
}));

jest.mock('sentry/views/seerExplorer/utils', () => ({
  ...jest.requireActual('sentry/views/seerExplorer/utils'),
  isSeerExplorerEnabled: () => true,
}));

function renderTopBar(width?: number) {
  if (width !== undefined) {
    jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(width);
  }

  const topBar = (
    <TopBar.Slot.Provider>
      <TopBar />
      <TopBar.Slot name="title">Page title</TopBar.Slot>
    </TopBar.Slot.Provider>
  );

  render(<Flex containerType="inline-size">{topBar}</Flex>, {
    organization: OrganizationFixture({
      features: ['gen-ai-features', 'seer-explorer'],
    }),
  });
}

describe('TopBar', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the title as an h1 by default', () => {
    renderTopBar();

    expect(
      screen.getByRole('heading', {name: 'Page title', level: 1})
    ).toBeInTheDocument();
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

    expect(screen.queryByRole('heading', {name: 'Issues'})).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Current Issue', level: 1})
    ).toBeInTheDocument();
  });

  it('uses icon-only actions below sm', () => {
    renderTopBar(Number.parseFloat(theme.container.sm) - 1);

    expect(screen.queryByText('Command Palette')).not.toBeInTheDocument();
    expect(screen.queryByText('Ask Seer')).not.toBeInTheDocument();
  });

  it('shows the Ask Seer label while keeping other actions compact at sm', () => {
    renderTopBar(Number.parseFloat(theme.container.sm));
    const askSeerButton = screen.getByRole('button', {name: 'Ask Seer'});

    expect(screen.queryByText('Command Palette')).not.toBeInTheDocument();
    expect(screen.getByText('Ask Seer')).toBeInTheDocument();
    expect(screen.queryByText('/')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toEqual([
      askSeerButton,
      screen.getByRole('button', {name: 'Command Palette'}),
      screen.getByRole('button', {name: 'Give Feedback'}),
    ]);
  });
});
