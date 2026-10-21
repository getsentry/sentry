import {Fragment} from 'react';
import {IconEllipsis} from '@sentry/icons/ellipsis';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FeatureBadge} from '@sentry/scraps/badge';
import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

describe('BreadcrumbList container-query collapse', () => {
  it('keeps a parent link reachable in the overflow menu', async () => {
    render(
      <BreadcrumbList items={[{type: 'link', label: 'Settings', to: '/settings/'}]} />
    );

    expect(screen.getByRole('link', {name: 'Settings'})).toHaveAttribute(
      'href',
      '/settings/'
    );
    await userEvent.click(screen.getByRole('button', {name: 'More breadcrumbs'}));
    expect(screen.getByRole('menuitemradio', {name: 'Settings'})).toHaveAttribute(
      'href',
      '/settings/'
    );
  });

  it('shows a label tooltip and a feature badge', async () => {
    render(
      <BreadcrumbList.Title
        item={{
          type: 'page-title',
          label: 'Security',
          trailingActions: {type: 'badge', element: <FeatureBadge type="new" />},
          labelTooltip: (
            <Stack align="start" gap="md">
              <Text align="left">Manage authentication.</Text>
              <ExternalLink href="https://example.com/docs/">Read the Docs</ExternalLink>
            </Stack>
          ),
        }}
      />
    );

    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByLabelText('new')).toBeInTheDocument();
    expect(screen.queryByRole('img', {name: 'More information'})).not.toBeInTheDocument();
    await userEvent.hover(screen.getByText('Security'));
    expect(await screen.findByText('Manage authentication.')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Read the Docs'})).toHaveAttribute(
      'href',
      'https://example.com/docs/'
    );
  });

  it('renders the parent breadcrumbs as an ordered list', () => {
    render(
      <BreadcrumbList items={[{type: 'link', label: 'Settings', to: '/settings/'}]} />
    );

    expect(screen.getByRole('list').tagName).toBe('OL');
  });

  it('renders the page-title label as a heading and hides dividers from AT', () => {
    render(
      <Fragment>
        <BreadcrumbList items={[{type: 'link', label: 'Settings', to: '/settings/'}]} />
        <BreadcrumbList.Title item={{type: 'page-title', label: 'General'}} />
      </Fragment>
    );

    expect(screen.getByRole('heading', {name: 'General', level: 1})).toBeInTheDocument();
    const title = screen.getByText('General');
    expect(title).toBeInTheDocument();

    // Parent links must not be marked current.
    expect(screen.getByRole('link', {name: 'Settings'})).not.toHaveAttribute(
      'aria-current'
    );
    expect(screen.getByRole('link', {name: 'Settings'})).toHaveAttribute(
      'data-test-id',
      'breadcrumb-link'
    );

    // The decorative slash dividers are hidden from the accessibility tree.
    const dividers = document.querySelectorAll('svg[role="img"]:not([aria-hidden])');
    expect(dividers).toHaveLength(0);
  });

  it('gives the select trigger a descriptive accessible name', async () => {
    render(
      <BreadcrumbList
        items={[
          {type: 'link', label: 'Settings', to: '/settings/'},
          {
            type: 'select',
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
        name: 'Switch javascript',
      })
    ).toBeInTheDocument();
  });

  it('links to the current selection in the narrow breadcrumb menu', async () => {
    render(
      <BreadcrumbList
        items={[
          {type: 'link', label: 'Settings', to: '/settings/'},
          {
            type: 'select',
            label: 'javascript',
            to: '/settings/org-slug/projects/javascript/',
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

    await userEvent.click(screen.getByRole('button', {name: 'More breadcrumbs'}));
    expect(screen.getByRole('menuitemradio', {name: 'javascript'})).toHaveAttribute(
      'href',
      '/settings/org-slug/projects/javascript/'
    );
    expect(screen.queryByRole('menuitemradio', {name: 'python'})).not.toBeInTheDocument();
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
            triggerIcon: <IconEllipsis />,
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
                  triggerIcon: <IconEllipsis />,
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

  it('keeps the menu open when an action declared before it appears', async () => {
    function TestTitle({showUpdate}: {showUpdate: boolean}) {
      return (
        <BreadcrumbList.Title
          item={{
            type: 'page-title',
            label: 'JAVASCRIPT-2X9',
            trailingActions: [
              showUpdate
                ? {type: 'button', element: <Button size="zero">Update</Button>}
                : null,
              {
                type: 'menu',
                triggerIcon: <IconEllipsis />,
                triggerLabel: 'More actions',
                items: [{key: 'delete', label: 'Delete'}],
              },
            ],
          }}
        />
      );
    }

    const {rerender} = render(<TestTitle showUpdate={false} />);

    await userEvent.click(screen.getByRole('button', {name: 'More actions'}));
    expect(await screen.findByRole('menuitemradio', {name: 'Delete'})).toBeVisible();

    rerender(<TestTitle showUpdate />);

    expect(screen.getByRole('button', {name: 'Update'})).toBeVisible();
    expect(screen.getByRole('menuitemradio', {name: 'Delete'})).toBeVisible();
  });

  it('renders an editable-title as a click-to-edit field', async () => {
    const onChange = jest.fn();
    render(
      <BreadcrumbList.Title
        item={{
          type: 'editable-title',
          value: 'My Dashboard',
          onChange,
          'aria-label': 'Edit dashboard name',
          leadingGraphic: <span data-test-id="title-graphic">D</span>,
          error: 'Invalid name',
        }}
      />
    );

    const heading = screen.getByRole('heading', {name: 'My Dashboard', level: 1});
    expect([...heading.querySelectorAll('*')].every(el => el.tagName === 'SPAN')).toBe(
      true
    );
    expect(heading).not.toContainElement(screen.getByTestId('title-graphic'));
    expect(heading).not.toContainElement(screen.getByText('Invalid name'));

    await userEvent.click(heading);
    const input = screen.getByRole('textbox', {name: 'Edit dashboard name'});
    expect(input.closest('h1')).toBeNull();
    await userEvent.clear(input);
    await userEvent.type(input, 'New Dashboard{Enter}');
    expect(onChange).toHaveBeenCalledWith('New Dashboard');
    expect(
      screen.getByRole('heading', {name: 'New Dashboard', level: 1})
    ).toBeInTheDocument();
  });
});
