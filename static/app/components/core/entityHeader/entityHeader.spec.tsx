import {Fragment} from 'react';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {Tag} from '@sentry/scraps/badge';
import {EntityHeader} from '@sentry/scraps/entityHeader';
import {Tooltip} from '@sentry/scraps/tooltip';

function getGridRules() {
  const grid = screen.getByRole('banner').firstElementChild as HTMLElement;
  return getEmotionRules(grid);
}

describe('EntityHeader', () => {
  describe('title', () => {
    it('renders the title as an h2, leaving the h1 to the TopBar', () => {
      render(
        <EntityHeader title={{label: 'Replay user', value: 'anonymous@example.com'}} />
      );

      // The descriptor is read before the value, so heading navigation lands on
      // "Replay user, anonymous@example.com" rather than a bare email address.
      expect(
        screen.getByRole('heading', {
          name: 'Replay user, anonymous@example.com',
          level: 2,
        })
      ).toBeInTheDocument();
      expect(screen.getByText('anonymous@example.com')).toBeVisible();

      // The page's single h1 lives in the TopBar title slot, so the header must
      // not introduce a competing one.
      const header = screen.getByRole('banner');
      expect(within(header).queryByRole('heading', {level: 1})).not.toBeInTheDocument();
    });

    it('renders the title as plain text, never a link', () => {
      render(<EntityHeader title={{label: 'Replay user', value: 'Session'}} />);

      // A heading that is wholly a link announces as both, and the breadcrumb
      // above already handles going up.
      expect(
        screen.getByRole('heading', {level: 2, name: 'Replay user, Session'})
      ).toBeVisible();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('renders tags beside the title and hides the leading graphic from AT', () => {
      render(
        <EntityHeader
          title={{
            label: 'Replay user',
            value: 'Session',
            leadingGraphic: {type: 'platform', platform: 'javascript'},
            tags: [
              <Tag key="live" variant="success">
                {'Live'}
              </Tag>,
            ],
          }}
        />
      );

      const heading = screen.getByRole('heading', {level: 2});
      expect(within(heading).getByText('Session')).toBeInTheDocument();
      expect(screen.getByText('Live')).toBeInTheDocument();
      // The title already names the entity, so an unlabelled graphic repeats
      // nothing and stays out of the accessibility tree.
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('exposes a labelled leading graphic, with its tooltip', async () => {
      render(
        <EntityHeader
          title={{
            label: 'Trace',
            value: 'Trace 8f2c1a',
            leadingGraphic: {
              type: 'project',
              projects: [
                {slug: 'frontend', platform: 'javascript'},
                {slug: 'backend', platform: 'python'},
              ],
              label: '2 projects',
              tooltip: 'frontend, backend',
            },
          }}
        />
      );

      // Which projects a trace touched is not in the title, so here the graphic
      // carries meaning and has to be reachable.
      const graphic = screen.getByRole('img', {name: '2 projects'});

      await userEvent.hover(graphic);
      expect(await screen.findByText('frontend, backend')).toBeInTheDocument();
    });

    it('draws a user avatar at the size the people slot shows, inside the same box', () => {
      render(
        <EntityHeader
          title={{
            label: 'Replay user',
            value: 'Session',
            leadingGraphic: {
              type: 'user',
              user: UserFixture({id: '1', name: 'Alice'}),
            },
          }}
        />
      );

      const avatar = screen.getByText('A').closest('span')!;
      expect(avatar).toHaveStyle({width: '20px', height: '20px'});

      const slot = avatar.parentElement!;
      expect(getEmotionRules(slot).some(rule => /width:\s*24px/.test(rule))).toBe(true);
    });

    it('renders no project graphic when no platform is known', () => {
      render(
        <EntityHeader
          title={{
            label: 'Trace',
            value: 'Trace 8f2c1a',
            leadingGraphic: {type: 'project', projects: [{slug: 'frontend'}]},
          }}
        />
      );

      expect(screen.getByRole('heading', {level: 2})).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('drops null tag entries', () => {
      const isLive = false;
      render(
        <EntityHeader
          title={{
            label: 'Replay user',
            value: 'Session',
            tags: [
              isLive ? (
                <Tag key="live" variant="success">
                  {'Live'}
                </Tag>
              ) : null,
              <Tag key="mobile" variant="muted">
                {'Mobile'}
              </Tag>,
            ],
          }}
        />
      );

      expect(screen.getByText('Mobile')).toBeInTheDocument();
      expect(screen.queryByText('Live')).not.toBeInTheDocument();
    });
  });

  describe('stats and metadata', () => {
    it('names a stat link by what it leads to, not by its number', () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[
            {
              type: 'link',
              label: 'Dead Clicks',
              value: 4,
              to: '/replays/1/?t_main=breadcrumbs',
            },
            {type: 'text', label: 'Rage Clicks', value: 0},
          ]}
        />
      );

      // A link named "4" says nothing in a links list. The label navigates, and
      // the name carries the value with it, so moving element by element reads
      // "4 Dead Clicks" in one go rather than "4", then "link, Dead Clicks".
      expect(screen.getByRole('link', {name: '4 Dead Clicks'})).toHaveAttribute(
        'href',
        '/replays/1/?t_main=breadcrumbs'
      );
      expect(screen.queryByRole('link', {name: '4'})).not.toBeInTheDocument();

      // And not announced a second time on its own, now the name speaks it.
      expect(screen.getByText('4')).toHaveAttribute('aria-hidden', 'true');

      // A text stat links nothing at all.
      expect(screen.getByText('Rage Clicks')).toBeInTheDocument();
      expect(screen.queryByRole('link', {name: 'Rage Clicks'})).not.toBeInTheDocument();
    });

    it('signals navigating with colour and explaining with an underline', () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[
            {type: 'link', label: 'Dead Clicks', value: 4, to: '/replays/1/'},
            {type: 'text', label: 'Rage Clicks', value: 0},
          ]}
        />
      );

      const link = screen.getByRole('link', {name: '4 Dead Clicks'});
      const plain = screen.getByText('Rage Clicks');

      const textColour = (element: HTMLElement) =>
        getEmotionRules(element)
          .join(' ')
          .match(/[;{]\s*color:\s*([^;}]+)/)?.[1]
          ?.trim();

      expect(textColour(link)).toBeDefined();
      expect(textColour(link)).not.toBe(textColour(plain));

      expect(link).not.toHaveStyle({textDecoration: 'underline'});
      expect(plain).not.toHaveStyle({textDecoration: 'underline'});
    });

    it('explains a stat label through a tooltip without restyling it', async () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[
            {
              type: 'text',
              label: 'Dead Clicks',
              value: 4,
              labelTooltip: 'A click that did not change anything.',
            },
          ]}
        />
      );

      await userEvent.hover(screen.getByText('Dead Clicks'));
      expect(
        await screen.findByText('A click that did not change anything.')
      ).toBeInTheDocument();
    });

    it('carries a breakdown in the value tooltip rather than in the row', async () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[
            {
              type: 'text',
              label: 'Errors',
              value: 3,
              valueTooltip: (
                <Fragment>
                  <Tooltip.Header>Errors</Tooltip.Header>
                  <Tooltip.Grid columns="1fr max-content">
                    <Tooltip.Row trailingItems={<span>2</span>}>
                      <span>javascript</span>
                    </Tooltip.Row>
                    <Tooltip.Row trailingItems={<span>1</span>}>
                      <span>python</span>
                    </Tooltip.Row>
                  </Tooltip.Grid>
                </Fragment>
              ),
            },
          ]}
        />
      );

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.queryByText('javascript')).not.toBeInTheDocument();

      await userEvent.hover(screen.getByText('3'));
      expect(await screen.findByText('javascript')).toBeInTheDocument();
      expect(screen.getByText('python')).toBeInTheDocument();
    });

    it('attaches a label tooltip to the link rather than nesting a tab stop', async () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[
            {
              type: 'link',
              label: 'Errors',
              value: 3,
              to: '/replays/1/?t_main=errors',
              labelTooltip: 'Errors recorded during this replay',
            },
          ]}
        />
      );

      const link = screen.getByRole('link', {name: '3 Errors'});
      expect(link).toHaveAttribute('href', '/replays/1/?t_main=errors');

      // The link is the only tab stop; InfoText would add a second one inside
      // the anchor.
      await userEvent.hover(link);
      expect(
        await screen.findByText('Errors recorded during this replay')
      ).toBeInTheDocument();
    });

    it('keeps the same element when a link stat receives its value', () => {
      const {rerender} = render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[
            {type: 'link', label: 'Errors', value: 0, to: '/replays/1/?t_main=errors'},
          ]}
        />
      );
      const before = screen.getByRole('link', {name: '0 Errors'});

      rerender(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[
            {type: 'link', label: 'Errors', value: 3, to: '/replays/1/?t_main=errors'},
          ]}
        />
      );

      expect(screen.getByRole('link', {name: '3 Errors'})).toBe(before);
    });

    it('gives a linked label the same metrics as an unlinked one', () => {
      const hasLabelFontSize = (element: HTMLElement) =>
        getEmotionRules(element).some(rule => /font-size:\s*12px/.test(rule));

      const {rerender} = render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[{type: 'text', label: 'Errors', value: 3}]}
        />
      );
      expect(hasLabelFontSize(screen.getByText('Errors'))).toBe(true);

      rerender(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[
            {type: 'link', label: 'Errors', value: 3, to: '/replays/1/?t_main=errors'},
          ]}
        />
      );

      expect(hasLabelFontSize(screen.getByRole('link', {name: '3 Errors'}))).toBe(true);
    });

    it('drops null entries so callers can inline conditionals', () => {
      const isVideoReplay = true;
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[
            isVideoReplay
              ? null
              : {type: 'text' as const, label: 'Dead Clicks', value: 4},
            {type: 'text', label: 'Errors', value: 2},
          ]}
          metadata={{
            label: 'Replay properties',
            items: [
              {label: 'Browser', values: ['Chrome 144']},
              isVideoReplay
                ? null
                : {label: 'Operating system', values: ['Windows >=10']},
            ],
          }}
        />
      );

      expect(screen.getByText('Errors')).toBeInTheDocument();
      expect(screen.getByText('Chrome 144')).toBeInTheDocument();
      expect(screen.queryByText('Dead Clicks')).not.toBeInTheDocument();
      expect(screen.queryByText('Windows >=10')).not.toBeInTheDocument();
    });

    it('keeps a later stat mounted when an earlier conditional stat appears', async () => {
      function TestHeader({showViewers}: {showViewers: boolean}) {
        return (
          <EntityHeader
            title={{label: 'Replay user', value: 'Session'}}
            stats={[
              showViewers
                ? {type: 'text' as const, label: 'Seen By', value: <span>2 viewers</span>}
                : null,
              {
                type: 'text',
                label: 'Note',
                value: <input aria-label="Scratch note" defaultValue="" />,
              },
            ]}
          />
        );
      }

      const {rerender} = render(<TestHeader showViewers={false} />);

      await userEvent.type(screen.getByRole('textbox', {name: 'Scratch note'}), 'kept');
      expect(screen.getByRole('textbox', {name: 'Scratch note'})).toHaveValue('kept');

      rerender(<TestHeader showViewers />);

      expect(screen.getByText('2 viewers')).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Scratch note'})).toHaveValue('kept');
    });

    it('holds space for people while they load, then renders the avatars', () => {
      const users = [UserFixture({id: '1', name: 'Alice', email: 'alice@example.com'})];

      const {rerender} = render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          people={{users: [], isLoading: true, label: 'Viewed by'}}
          stats={[{type: 'text', label: 'Errors', value: 2}]}
        />
      );

      expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();

      rerender(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          people={{users, label: 'Viewed by'}}
          stats={[{type: 'text', label: 'Errors', value: 2}]}
        />
      );

      expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
      expect(screen.getByText('Errors')).toBeInTheDocument();
    });

    it('names the relationship rather than leaving the avatars unexplained', async () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          people={{
            users: [UserFixture({id: '1', name: 'Alice', email: 'alice@example.com'})],
            label: 'Viewed by',
          }}
        />
      );

      // A bare stack of faces does not say what it represents.
      await userEvent.hover(screen.getByTestId('letter_avatar-avatar'));
      expect(await screen.findByText('Viewed by')).toBeInTheDocument();
      expect(screen.getByText('Alice (alice@example.com)')).toBeInTheDocument();
    });

    it('reads the people out by name rather than as a stack of initials', () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          people={{
            users: [
              UserFixture({id: '1', name: 'Alice'}),
              UserFixture({id: '2', name: 'Bob'}),
            ],
            label: 'Viewed by',
          }}
        />
      );

      // Most people have no uploaded avatar, and a letter avatar reaches the
      // tree as initials with an unreliable name. The avatars are not focusable
      // either, so their tooltips are mouse-only. Naming everyone as text fixes
      // all of that, and does not rely on a `group` role being announced.
      expect(screen.getByText('Viewed by: Alice, Bob')).toBeInTheDocument();

      // And the stack itself is decorative now the names are spoken.
      const stack = screen
        .getAllByTestId('letter_avatar-avatar')[0]!
        .closest('[aria-hidden]');
      expect(stack).toBeInTheDocument();
    });

    it('renders nothing for people once they resolve to nobody', () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          people={{users: [], label: 'Viewed by'}}
          stats={[{type: 'text', label: 'Errors', value: 2}]}
        />
      );

      expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
      expect(screen.getByRole('banner').querySelectorAll('hr')).toHaveLength(0);
    });

    it('names each metadata item, and the row they belong to', () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          metadata={{
            label: 'Replay properties',
            items: [
              {label: 'Browser', values: ['Chrome', '144.0.0']},
              {label: 'Operating system', values: ['Windows', '>=10']},
            ],
          }}
        />
      );

      // The row says what these strings have to do with each other, and each
      // item says what it is — otherwise a screen reader meets "Chrome 144.0.0"
      // with nothing to tie it to a browser, or to the replay.
      const row = screen.getByRole('list', {name: 'Replay properties'});
      const items = within(row).getAllByRole('listitem');

      // A listitem takes no name from its content — a screen reader reads the
      // content as it traverses — so the label has to be text inside it, and it
      // has to come first.
      expect(items).toHaveLength(2);

      const readsLabelFirst = (item: HTMLElement, label: string, values: string) => {
        const labelNode = within(item).getByText(label);
        const valueNode = within(item).getByText(values);
        return Boolean(
          labelNode.compareDocumentPosition(valueNode) & Node.DOCUMENT_POSITION_FOLLOWING
        );
      };

      expect(readsLabelFirst(items[0]!, 'Browser', 'Chrome 144.0.0')).toBe(true);
      expect(readsLabelFirst(items[1]!, 'Operating system', 'Windows >=10')).toBe(true);
    });

    it('renders several values as one run, and hides the label unless asked', () => {
      const {rerender} = render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          metadata={{
            label: 'Replay properties',
            items: [{label: 'Browser', values: ['Chrome', '144.0.0']}],
          }}
        />
      );

      expect(screen.getByText('Chrome 144.0.0')).toBeVisible();
      // Present for a screen reader, clipped out of the visual layout.
      expect(screen.getByText('Browser')).toHaveStyle({clipPath: 'inset(50%)'});

      rerender(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          metadata={{
            label: 'Replay properties',
            items: [{label: 'Browser', values: ['Chrome', '144.0.0'], showLabel: true}],
          }}
        />
      );

      // Showing it is a question of visibility only — what is read is unchanged.
      const item = screen.getByRole('listitem');
      expect(screen.getByText('Browser')).not.toHaveStyle({clipPath: 'inset(50%)'});
      expect(within(item).getByText('Browser')).toBeInTheDocument();
      expect(within(item).getByText('Chrome 144.0.0')).toBeInTheDocument();
    });

    it('never hides a focusable element on a link stat', () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[
            {
              type: 'link',
              label: 'Errors',
              value: 3,
              to: '/replays/1/?t_main=errors',
              labelTooltip: 'From 2 projects',
            },
          ]}
        />
      );

      // The value is hidden on a link stat, because the link speaks it as part
      // of its own name. Anything hidden must also be unreachable: a tab stop
      // that announces nothing is focus landing somewhere a screen reader
      // cannot follow.
      const header = screen.getByRole('banner');
      const hiddenFocusable = header.querySelectorAll(
        '[aria-hidden="true"] [tabindex], [aria-hidden="true"][tabindex]'
      );

      expect(hiddenFocusable).toHaveLength(0);
    });

    it('renders a tooltip on a metadata item', async () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          metadata={{
            label: 'Page properties',
            items: [{label: 'Metric', values: ['TTFB'], tooltip: 'Time to First Byte'}],
          }}
        />
      );

      await userEvent.hover(screen.getByText('TTFB'));
      expect(await screen.findByText('Time to First Byte')).toBeInTheDocument();
    });
  });

  describe('loading', () => {
    it('renders one skeleton per declared slot, preserving the slot count', () => {
      render(
        <EntityHeader
          isLoading
          title={{label: 'Replay user', value: 'Session'}}
          subtitle="A subtitle"
          stats={[
            {type: 'text', label: 'Dead Clicks', value: 4},
            {type: 'text', label: 'Errors', value: 2},
          ]}
          metadata={{
            label: 'Replay properties',
            items: [
              {label: 'Browser', values: ['Chrome 144']},
              {label: 'Operating system', values: ['Windows >=10']},
            ],
          }}
        />
      );

      expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(6);

      expect(screen.queryByText('Dead Clicks')).not.toBeInTheDocument();
      expect(screen.queryByText('Errors')).not.toBeInTheDocument();
      expect(screen.queryByText('A subtitle')).not.toBeInTheDocument();

      // The heading stays, so the page's structure does not change as the data
      // lands and heading navigation still finds the entity mid-load.
      // Named by the label alone while loading: the value is not known, and a
      // caller's fallback would otherwise be asserted as the entity's name.
      expect(screen.getByRole('heading', {level: 2, name: 'Replay user'})).toBeVisible();

      // And the region says it is in flux, which is the only signal a screen
      // reader gets that more is coming.
      expect(screen.getByRole('banner')).toHaveAttribute('aria-busy', 'true');
    });

    it('shows the people skeleton alongside the stats, not after them', () => {
      const {rerender} = render(
        <EntityHeader
          isLoading
          title={{label: 'Replay user', value: 'Session'}}
          people={{users: [], label: 'Viewed by'}}
          stats={[{type: 'text', label: 'Errors', value: 2}]}
        />
      );

      expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(3);

      rerender(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          people={{users: [], isLoading: true, label: 'Viewed by'}}
          stats={[{type: 'text', label: 'Errors', value: 2}]}
        />
      );

      expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(1);
      expect(screen.getByText('Errors')).toBeInTheDocument();
    });

    it('holds one stat while the rest of the header is live', () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[
            {type: 'text', label: 'Dead Clicks', value: 4},
            {type: 'text', label: 'Errors', value: 0, isLoading: true},
          ]}
        />
      );

      // A count that arrives after the entity does would otherwise assert a
      // zero it has not confirmed.
      expect(screen.getByText('Dead Clicks')).toBeInTheDocument();
      expect(screen.queryByText('Errors')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(1);
    });

    it('reports busy while any one slot is still loading', () => {
      const {rerender} = render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[{type: 'text', label: 'Errors', value: 0, isLoading: true}]}
        />
      );

      expect(screen.getByRole('banner')).toHaveAttribute('aria-busy', 'true');

      rerender(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[{type: 'text', label: 'Errors', value: 2}]}
        />
      );

      expect(screen.getByRole('banner')).toHaveAttribute('aria-busy', 'false');
    });
  });

  describe('layout', () => {
    it('reads in the order the narrow layout shows, so focus follows the eye', () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[
            {type: 'link', label: 'Errors', value: 3, to: '/replays/1/?t_main=errors'},
          ]}
          metadata={{
            label: 'Replay properties',
            items: [
              {label: 'Browser', values: ['Chrome 144'], tooltip: 'The browser used'},
            ],
          }}
        />
      );

      // Below `lg` the grid stacks title, then metadata, then stats. Source
      // order has to agree, or a screen reader reads the numbers before the
      // facts above them, and Tab skips the middle row and comes back to it.
      const follows = (first: Element, second: Element) =>
        Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

      const title = screen.getByRole('heading', {level: 2});
      const metadata = screen.getByText('Chrome 144');
      const stat = screen.getByRole('link', {name: '3 Errors'});

      expect(follows(title, metadata)).toBe(true);
      expect(follows(metadata, stat)).toBe(true);
    });

    it('pins the stat height so an async value cannot shift the rows below', () => {
      const {rerender} = render(
        <EntityHeader
          isLoading
          title={{label: 'Replay user', value: 'Session'}}
          stats={[{type: 'text', label: 'Seen By', value: null}]}
          metadata={{
            label: 'Replay properties',
            items: [{label: 'Browser', values: ['Chrome 144']}],
          }}
        />
      );

      // Stats come last in the DOM, so that they follow the metadata they sit
      // under in the narrow layout.
      const placeholders = screen.getAllByTestId('loading-placeholder');
      const skeleton = placeholders.at(-1)!;
      expect(
        getEmotionRules(skeleton.parentElement!).some(r => /height:\s*32px/.test(r))
      ).toBe(true);

      rerender(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[
            {
              type: 'text',
              label: 'Seen By',
              value: <img alt="" height={25} width={50} />,
            },
          ]}
          metadata={{
            label: 'Replay properties',
            items: [{label: 'Browser', values: ['Chrome 144']}],
          }}
        />
      );

      const loadedStatBox = screen.getByText('Seen By').closest('div')!.parentElement!;
      expect(getEmotionRules(loadedStatBox).some(r => /height:\s*32px/.test(r))).toBe(
        true
      );
    });

    it('reorders the stats below the metadata in a narrow container', () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={[{type: 'text', label: 'Errors', value: 2}]}
          metadata={{
            label: 'Replay properties',
            items: [{label: 'Browser', values: ['Chrome 144']}],
          }}
        />
      );

      const rules = getGridRules();

      expect(
        rules.some(
          r =>
            !r.includes('@container') &&
            /grid-template-areas:\s*"title"\s*"context"\s*"stats"/.test(r)
        )
      ).toBe(true);

      expect(
        rules.some(
          r =>
            /@container[^{]*min-width:\s*640px/.test(r) &&
            /grid-template-areas:\s*"title stats"\s*"context context"/.test(r)
        )
      ).toBe(true);

      expect(
        rules.some(
          r => /@media[^{]*min-width:\s*0px/.test(r) && r.includes('grid-template-areas')
        )
      ).toBe(false);
    });

    it('emits no row for a slot that was not supplied', () => {
      const {rerender} = render(
        <EntityHeader title={{label: 'Replay user', value: 'Session'}} />
      );

      let rules = getGridRules();
      expect(rules.some(r => /grid-template-areas:\s*"title"\s*;/.test(r))).toBe(true);
      expect(rules.some(r => r.includes('context'))).toBe(false);
      expect(rules.some(r => r.includes('stats'))).toBe(false);

      rerender(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          metadata={{
            label: 'Replay properties',
            items: [{label: 'Browser', values: ['Chrome 144']}],
          }}
        />
      );

      rules = getGridRules();
      expect(rules.some(r => /grid-template-areas:\s*"title"\s*"context"/.test(r))).toBe(
        true
      );
      expect(rules.some(r => r.includes('stats'))).toBe(false);
    });
  });
});
