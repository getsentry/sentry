import type {ComponentProps} from 'react';
import {expectTypeOf} from 'expect-type';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {IconStack} from 'sentry/icons';

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
      <TopBar.Slot name="breadcrumbs" title={{type: 'page-title', label: 'Page title'}} />
    </TopBar.Slot.Provider>
  );

  render(<Flex containerType="inline-size">{topBar}</Flex>, {
    organization: OrganizationFixture({
      features: ['seer-explorer'],
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

  it('keeps only the page-title label inside the single TopBar heading', () => {
    render(
      <TopBar.Slot.Provider>
        <TopBar />
        <TopBar.Slot
          name="breadcrumbs"
          title={{
            type: 'page-title',
            label: 'Current Issue',
            leadingGraphic: <IconStack data-test-id="title-graphic" />,
            pagination: {
              previous: {ariaLabel: 'Previous issue'},
              next: {ariaLabel: 'Next issue', to: '/issues/next/'},
            },
            trailingActions: {
              type: 'button',
              element: <Button>Resolve</Button>,
            },
          }}
        >
          <BreadcrumbList items={[{type: 'link', label: 'Issues', to: '/issues/'}]} />
        </TopBar.Slot>
      </TopBar.Slot.Provider>,
      {organization: OrganizationFixture()}
    );

    expect(screen.queryByRole('heading', {name: 'Issues'})).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Current Issue', level: 1})
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('banner')).getAllByRole('heading', {level: 1})
    ).toHaveLength(1);
    expect(
      within(screen.getByRole('heading', {name: 'Current Issue', level: 1})).queryByRole(
        'link'
      )
    ).not.toBeInTheDocument();
    const heading = screen.getByRole('heading', {name: 'Current Issue', level: 1});
    expect(heading).not.toContainElement(screen.getByTestId('title-graphic'));
    expect(heading).not.toContainElement(
      screen.getByRole('button', {name: 'Previous issue'})
    );
    expect(heading).not.toContainElement(
      screen.getByRole('button', {name: 'Next issue'})
    );
    expect(heading).not.toContainElement(screen.getByRole('button', {name: 'Resolve'}));
    expect(screen.getByRole('link', {name: 'Issues'})).toHaveAttribute(
      'href',
      '/issues/'
    );
  });

  it('updates the title and removes it when the page unmounts', () => {
    function Page({title}: {title?: string}) {
      return (
        <TopBar.Slot.Provider>
          <TopBar />
          {title && (
            <TopBar.Slot name="breadcrumbs" title={{type: 'page-title', label: title}} />
          )}
        </TopBar.Slot.Provider>
      );
    }

    const {rerender} = render(<Page title="First page" />);
    expect(screen.getByRole('heading', {name: 'First page'})).toBeInTheDocument();

    rerender(<Page title="Second page" />);
    expect(screen.getByRole('heading', {name: 'Second page'})).toBeInTheDocument();
    expect(screen.queryByText('First page')).not.toBeInTheDocument();

    rerender(<Page />);
    expect(screen.queryByText('Second page')).not.toBeInTheDocument();
  });

  it('supports an editable title', async () => {
    const onChange = jest.fn();
    render(
      <TopBar.Slot.Provider>
        <TopBar />
        <TopBar.Slot
          name="breadcrumbs"
          title={{
            type: 'editable-title',
            value: 'My dashboard',
            'aria-label': 'Dashboard name',
            onChange,
          }}
        />
      </TopBar.Slot.Provider>
    );

    await userEvent.click(screen.getByText('My dashboard'));
    const input = screen.getByRole('textbox', {name: 'Dashboard name'});
    await userEvent.clear(input);
    await userEvent.type(input, 'New dashboard{Enter}');
    expect(onChange).toHaveBeenCalledWith('New dashboard');
  });

  it('requires a typed title on the breadcrumbs slot', () => {
    type Props = ComponentProps<typeof TopBar.Slot>;
    expectTypeOf<{name: 'breadcrumbs'}>().not.toMatchTypeOf<Props>();
    expectTypeOf<{children: string; name: 'title'}>().not.toMatchTypeOf<Props>();
    expectTypeOf<{name: 'breadcrumbs'; title: string}>().not.toMatchTypeOf<Props>();
    expectTypeOf<{
      name: 'breadcrumbs';
      title: {label: string; type: 'page-title'};
    }>().toMatchTypeOf<Props>();
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
