import {Fragment} from 'react';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {Tag} from '@sentry/scraps/badge';
import type {EntityHeaderProps} from '@sentry/scraps/entityHeader';
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

    it('falls back to the generic tile when no project has a known platform', () => {
      render(
        <EntityHeader
          title={{
            label: 'Trace',
            value: 'GET /api/',
            leadingGraphic: {
              type: 'project',
              projects: [{slug: 'backend'}],
              label: '1 project',
            },
          }}
        />
      );

      // Not an empty 24px box, and not a named image with nothing in it.
      const graphic = screen.getByRole('img', {name: '1 project'});
      expect(graphic.querySelector('img')).toBeInTheDocument();
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
          stats={{
            label: 'Replay stats',
            items: [
              {
                type: 'link',
                label: 'Dead Clicks',
                value: 4,
                to: '/replays/1/?t_main=breadcrumbs',
              },
              {type: 'text', label: 'Rage Clicks', value: 0},
            ],
          }}
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
          stats={{
            label: 'Replay stats',
            items: [
              {type: 'link', label: 'Dead Clicks', value: 4, to: '/replays/1/'},
              {type: 'text', label: 'Rage Clicks', value: 0},
            ],
          }}
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
          stats={{
            label: 'Replay stats',
            items: [
              {
                type: 'text',
                label: 'Dead Clicks',
                value: 4,
                labelTooltip: 'A click that did not change anything.',
              },
            ],
          }}
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
          stats={{
            label: 'Replay stats',
            items: [
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
            ],
          }}
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
          stats={{
            label: 'Replay stats',
            items: [
              {
                type: 'link',
                label: 'Errors',
                value: 3,
                to: '/replays/1/?t_main=errors',
                labelTooltip: 'Errors recorded during this replay',
              },
            ],
          }}
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
          stats={{
            label: 'Replay stats',
            items: [
              {type: 'link', label: 'Errors', value: 0, to: '/replays/1/?t_main=errors'},
            ],
          }}
        />
      );
      const before = screen.getByRole('link', {name: '0 Errors'});

      rerender(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={{
            label: 'Replay stats',
            items: [
              {type: 'link', label: 'Errors', value: 3, to: '/replays/1/?t_main=errors'},
            ],
          }}
        />
      );

      expect(screen.getByRole('link', {name: '3 Errors'})).toBe(before);
    });

    it('gives a linked label the same metrics as an unlinked one', () => {
      // `Link` emits `text-box-trim` but no font size, so an anchor that does
      // not carry the label's own text styles trims to whatever it inherits
      // and the row's baseline moves when a stat resolves into a link.
      //
      // Compared against each other rather than against a number, so the two
      // stay in step if the label's size is ever redesigned.
      const fontSize = (element: HTMLElement) =>
        getEmotionRules(element)
          .join(' ')
          .match(/font-size:\s*[^;]+/)?.[0];

      const {rerender} = render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={{
            label: 'Replay stats',
            items: [{type: 'text', label: 'Errors', value: 3}],
          }}
        />
      );
      const plain = fontSize(screen.getByText('Errors'));
      expect(plain).toBeDefined();

      rerender(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={{
            label: 'Replay stats',
            items: [
              {type: 'link', label: 'Errors', value: 3, to: '/replays/1/?t_main=errors'},
            ],
          }}
        />
      );

      expect(fontSize(screen.getByRole('link', {name: '3 Errors'}))).toBe(plain);
    });

    it('drops null entries so callers can inline conditionals', () => {
      const isVideoReplay = true;
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={{
            label: 'Replay stats',
            items: [
              isVideoReplay
                ? null
                : {type: 'text' as const, label: 'Dead Clicks', value: 4},
              {type: 'text', label: 'Errors', value: 2},
            ],
          }}
          metadata={{
            label: 'Replay properties',
            items: [
              {label: 'Browser', type: 'text', value: 'Chrome 144'},
              isVideoReplay
                ? null
                : {label: 'Operating system', type: 'text', value: 'Windows >=10'},
            ],
          }}
        />
      );

      expect(screen.getByText('Errors')).toBeInTheDocument();
      expect(screen.getByText('Chrome 144')).toBeInTheDocument();
      expect(screen.queryByText('Dead Clicks')).not.toBeInTheDocument();
      expect(screen.queryByText('Windows >=10')).not.toBeInTheDocument();
    });

    it('keeps a later stat mounted when an earlier conditional stat appears', () => {
      function TestHeader({showViewers}: {showViewers: boolean}) {
        return (
          <EntityHeader
            title={{label: 'Replay user', value: 'Session'}}
            stats={{
              label: 'Replay stats',
              items: [
                showViewers ? {type: 'text' as const, label: 'Seen By', value: 2} : null,
                {type: 'text', label: 'Note', value: 7},
              ],
            }}
          />
        );
      }

      const {rerender} = render(<TestHeader showViewers={false} />);

      // Keyed by position in the filtered array, the later stat's key would
      // shift from 0 to 1 when the earlier one appears, and React would
      // replace its node rather than move it.
      const noteBefore = screen.getByText('Note');

      rerender(<TestHeader showViewers />);

      expect(screen.getByText('Seen By')).toBeInTheDocument();
      expect(screen.getByText('Note')).toBe(noteBefore);
    });

    it('holds space for people while they load, then renders the avatars', () => {
      const users = [UserFixture({id: '1', name: 'Alice', email: 'alice@example.com'})];

      const {rerender} = render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          people={{users: [], isLoading: true, label: 'Viewed by'}}
          stats={{
            label: 'Replay stats',
            items: [{type: 'text', label: 'Errors', value: 2}],
          }}
        />
      );

      expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();

      rerender(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          people={{users, label: 'Viewed by'}}
          stats={{
            label: 'Replay stats',
            items: [{type: 'text', label: 'Errors', value: 2}],
          }}
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

    it('names both rows, so neither is a run of loose strings', () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          metadata={{
            label: 'Replay properties',
            items: [
              {
                label: 'Browser',
                type: 'text',
                value: 'Chrome',
                secondary: {label: 'version', value: '144'},
              },
            ],
          }}
          stats={{
            label: 'Replay stats',
            items: [{type: 'text', label: 'Errors', value: 2}],
          }}
        />
      );

      expect(screen.getByRole('list', {name: 'Replay properties'})).toBeInTheDocument();
      expect(screen.getByRole('list', {name: 'Replay stats'})).toBeInTheDocument();

      // A metadata item is one stop, named from everything in it. Marking the
      // label and value as a term and its definition made VoiceOver narrate
      // the pairing — "term", "selectable list item", "end of term" — before
      // ever reaching the value.
      expect(screen.queryByRole('term')).not.toBeInTheDocument();
      const [property] = screen.getAllByRole('listitem');
      expect(property).toHaveTextContent('Browser');
      expect(property).toHaveTextContent('Chrome');
    });

    it('keeps people beside the stats list rather than inside it', () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          people={{users: [UserFixture({id: '1', name: 'Alice'})], label: 'Viewed by'}}
          stats={{
            label: 'Replay stats',
            items: [{type: 'text', label: 'Errors', value: 2}],
          }}
        />
      );

      // A list named for its stats cannot hold something that is not one.
      const statsList = screen.getByRole('list', {name: 'Replay stats'});
      expect(within(statsList).getAllByRole('listitem')).toHaveLength(1);
      expect(within(statsList).queryByText(/Viewed by/)).not.toBeInTheDocument();
      expect(screen.getByText('Viewed by: Alice')).toBeInTheDocument();
    });

    it('renders people with no stats, and stats with no people', () => {
      const users = [UserFixture({id: '1', name: 'Alice', email: 'alice@example.com'})];

      const {rerender} = render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          people={{users, label: 'Viewed by'}}
        />
      );

      expect(screen.getByText('Viewed by: Alice')).toBeInTheDocument();

      rerender(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={{
            label: 'Replay stats',
            items: [{type: 'text', label: 'Errors', value: 2}],
          }}
        />
      );

      expect(screen.queryByText(/Viewed by/)).not.toBeInTheDocument();
      expect(screen.getByText('Errors')).toBeInTheDocument();
    });

    it('renders nothing for people once they resolve to nobody', () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          people={{users: [], label: 'Viewed by'}}
          stats={{
            label: 'Replay stats',
            items: [{type: 'text', label: 'Errors', value: 2}],
          }}
        />
      );

      expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
      expect(screen.queryByText(/Viewed by/)).not.toBeInTheDocument();
    });

    it('names a metadata link from its key and its value', () => {
      render(
        <EntityHeader
          title={{label: 'Release', value: 'javascript-sdk'}}
          metadata={{
            label: 'Release properties',
            items: [
              {label: 'Version', type: 'link', value: '8.42.0', to: '/releases/8.42.0/'},
            ],
          }}
        />
      );

      // A links list showing "8.42.0" says nothing about what it leads to.
      // The mirror of a stat, where the label links and carries the count.
      expect(screen.getByRole('link', {name: 'Version 8.42.0'})).toHaveAttribute(
        'href',
        '/releases/8.42.0/'
      );

      // And the key is not repeated beside it — the link already speaks it.
      const item = screen.getByRole('listitem');
      expect(item).toHaveTextContent(/^8\.42\.0$/);
    });

    it('names each metadata item, and the row they belong to', () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          metadata={{
            label: 'Replay properties',
            items: [
              {
                label: 'Browser',
                type: 'text',
                value: 'Chrome',
                secondary: {label: 'version', value: '144.0.0'},
              },
              {
                label: 'Operating system',
                type: 'text',
                value: 'Windows',
                secondary: {label: 'version', value: '>=10'},
              },
            ],
          }}
        />
      );

      // The row says what these strings have to do with each other, and each
      // value says what it is — otherwise a screen reader meets "144.0.0" with
      // nothing to tie it to a browser version, or to the replay.
      const row = screen.getByRole('list', {name: 'Replay properties'});
      const items = within(row).getAllByRole('listitem');
      expect(items).toHaveLength(2);

      // A listitem takes no name from its content — a screen reader reads the
      // content as it traverses — so each key is text inside it, ahead of the
      // value it names. The child key is composed with the parent.
      expect(items[0]).toHaveTextContent(/^BrowserChromeBrowser version144\.0\.0$/);
      expect(items[1]).toHaveTextContent(
        /^Operating systemWindowsOperating system version>=10$/
      );
    });

    it('labels each value, and hides the keys unless asked', () => {
      const {rerender} = render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          metadata={{
            label: 'Replay properties',
            items: [
              {
                label: 'Browser',
                type: 'text',
                value: 'Chrome',
                secondary: {label: 'version', value: '144.0.0'},
              },
            ],
          }}
        />
      );

      expect(screen.getByText('Chrome')).toBeVisible();
      expect(screen.getByText('144.0.0')).toBeVisible();
      // Both keys are present for a screen reader, clipped out of the layout.
      expect(screen.getByText('Browser')).toHaveStyle({clipPath: 'inset(50%)'});
      expect(screen.getByText('Browser version')).toHaveStyle({
        clipPath: 'inset(50%)',
      });

      rerender(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          metadata={{
            label: 'Replay properties',
            items: [
              {
                label: 'Browser',
                type: 'text',
                value: 'Chrome',
                secondary: {label: 'version', value: '144.0.0'},
                mode: 'full',
              },
            ],
          }}
        />
      );

      // Showing the parent key is a question of visibility only — what is read
      // is unchanged, and the child key stays hidden either way.
      const item = screen.getByRole('listitem');
      expect(screen.getByText('Browser')).not.toHaveStyle({clipPath: 'inset(50%)'});
      expect(screen.getByText('Browser version')).toHaveStyle({
        clipPath: 'inset(50%)',
      });
      expect(item).toHaveTextContent(/^BrowserChromeBrowser version144\.0\.0$/);
    });

    it('never hides a focusable element on a link stat', () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={{
            label: 'Replay stats',
            items: [
              {
                type: 'link',
                label: 'Errors',
                value: 3,
                to: '/replays/1/?t_main=errors',
                labelTooltip: 'From 2 projects',
              },
            ],
          }}
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
            items: [
              {
                label: 'Metric',
                type: 'text',
                value: 'TTFB',
                tooltip: 'Time to First Byte',
              },
            ],
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
          stats={{
            label: 'Replay stats',
            items: [
              {type: 'text', label: 'Dead Clicks', value: 4},
              {type: 'text', label: 'Errors', value: 2},
            ],
          }}
          metadata={{
            label: 'Replay properties',
            items: [
              {label: 'Browser', type: 'text', value: 'Chrome 144'},
              {label: 'Operating system', type: 'text', value: 'Windows >=10'},
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

    it('keeps the grid template steady when declared slots resolve late', () => {
      // What the replay consumer does: every item is gated on one request, so
      // the first paint has none of them.
      const build = (hasData: boolean): EntityHeaderProps => ({
        isLoading: !hasData,
        title: {label: 'Replay user', value: 'Session'},
        metadata: {
          label: 'Replay properties',
          items: [
            hasData ? {label: 'Started at', type: 'text', value: '2h ago'} : null,
            hasData ? {label: 'Browser', type: 'text', value: 'Chrome'} : null,
          ],
        },
        stats: {
          label: 'Replay stats',
          items: [{type: 'text', label: 'Errors', value: 0}],
        },
      });

      const {rerender} = render(<EntityHeader {...build(false)} />);
      const loading = getGridRules().filter(rule => rule.includes('grid-template-areas'));

      // The declared metadata row holds its space rather than arriving with
      // the data: title + two metadata slots + one stat.
      expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(4);

      rerender(<EntityHeader {...build(true)} />);

      expect(getGridRules().filter(rule => rule.includes('grid-template-areas'))).toEqual(
        loading
      );
      expect(screen.getByText('Chrome')).toBeInTheDocument();
    });

    it('shows the people skeleton alongside the stats, not after them', () => {
      const {rerender} = render(
        <EntityHeader
          isLoading
          title={{label: 'Replay user', value: 'Session'}}
          people={{users: [], label: 'Viewed by'}}
          stats={{
            label: 'Replay stats',
            items: [{type: 'text', label: 'Errors', value: 2}],
          }}
        />
      );

      expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(3);

      rerender(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          people={{users: [], isLoading: true, label: 'Viewed by'}}
          stats={{
            label: 'Replay stats',
            items: [{type: 'text', label: 'Errors', value: 2}],
          }}
        />
      );

      expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(1);
      expect(screen.getByText('Errors')).toBeInTheDocument();
    });

    it('holds one stat while the rest of the header is live', () => {
      render(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={{
            label: 'Replay stats',
            items: [
              {type: 'text', label: 'Dead Clicks', value: 4},
              {type: 'text', label: 'Errors', value: 0, isLoading: true},
            ],
          }}
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
          stats={{
            label: 'Replay stats',
            items: [{type: 'text', label: 'Errors', value: 0, isLoading: true}],
          }}
        />
      );

      expect(screen.getByRole('banner')).toHaveAttribute('aria-busy', 'true');

      rerender(
        <EntityHeader
          title={{label: 'Replay user', value: 'Session'}}
          stats={{
            label: 'Replay stats',
            items: [{type: 'text', label: 'Errors', value: 2}],
          }}
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
          stats={{
            label: 'Replay stats',
            items: [
              {type: 'link', label: 'Errors', value: 3, to: '/replays/1/?t_main=errors'},
            ],
          }}
          metadata={{
            label: 'Replay properties',
            items: [
              {
                label: 'Browser',
                type: 'text',
                value: 'Chrome 144',
                tooltip: 'The browser used',
              },
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
          stats={{
            label: 'Replay stats',
            items: [{type: 'text', label: 'Seen By', value: 0}],
          }}
          metadata={{
            label: 'Replay properties',
            items: [{label: 'Browser', type: 'text', value: 'Chrome 144'}],
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
          people={{users: [UserFixture({id: '1', name: 'Alice'})], label: 'Viewed by'}}
          stats={{
            label: 'Replay stats',
            items: [{type: 'text', label: 'Seen By', value: 2}],
          }}
          metadata={{
            label: 'Replay properties',
            items: [{label: 'Browser', type: 'text', value: 'Chrome 144'}],
          }}
        />
      );

      const loadedStatBox = screen.getByText('Seen By').closest('div')!.parentElement!;
      expect(getEmotionRules(loadedStatBox).some(r => /height:\s*32px/.test(r))).toBe(
        true
      );
    });
  });
});
