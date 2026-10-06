import {Fragment} from 'react';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {Tag} from '@sentry/scraps/badge';
import {EntityHeader} from '@sentry/scraps/entityHeader';
import {Tooltip} from '@sentry/scraps/tooltip';

/** The `Grid` that owns the template is the header's only child. */
function getGridRules() {
  const grid = screen.getByRole('banner').firstElementChild as HTMLElement;
  return getEmotionRules(grid);
}

describe('EntityHeader', () => {
  describe('title', () => {
    it('renders the title as an h2, leaving the h1 to the TopBar', () => {
      render(<EntityHeader title={{label: 'anonymous@example.com'}} />);

      expect(
        screen.getByRole('heading', {name: 'anonymous@example.com', level: 2})
      ).toBeInTheDocument();

      // The page's single h1 lives in the TopBar title slot, so the header must
      // not introduce a competing one.
      const header = screen.getByRole('banner');
      expect(within(header).queryByRole('heading', {level: 1})).not.toBeInTheDocument();
    });

    it('links the title only when a destination is given', () => {
      const {rerender} = render(<EntityHeader title={{label: 'Session'}} />);
      expect(screen.queryByRole('link')).not.toBeInTheDocument();

      rerender(<EntityHeader title={{label: 'Session', to: '/replays/'}} />);
      expect(screen.getByRole('link', {name: 'Session'})).toHaveAttribute(
        'href',
        '/replays/'
      );
    });

    it('renders tags beside the title and hides the leading graphic from AT', () => {
      render(
        <EntityHeader
          title={{
            label: 'Session',
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
            label: 'Trace 8f2c1a',
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
            label: 'Session',
            leadingGraphic: {
              type: 'user',
              user: UserFixture({id: '1', name: 'Alice'}),
            },
          }}
        />
      );

      // The people slot's avatars are 24 with a 2px border, so their visible
      // disc is 20. Drawing this one at 24 would make it the larger of the two
      // circles in the same header, so it is 20 centred in a 24 box.
      const avatar = screen.getByText('A').closest('span')!;
      expect(avatar).toHaveStyle({width: '20px', height: '20px'});

      const slot = avatar.parentElement!;
      expect(getEmotionRules(slot).some(rule => /width:\s*24px/.test(rule))).toBe(true);
    });

    it('renders no project graphic when no platform is known', () => {
      render(
        <EntityHeader
          title={{
            label: 'Trace 8f2c1a',
            leadingGraphic: {type: 'project', projects: [{slug: 'frontend'}]},
          }}
        />
      );

      // ProjectsBadge falls back to an all-projects glyph for an empty list,
      // which means something on a saved view and nothing on a detail page.
      expect(screen.getByRole('heading', {level: 2})).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('drops null tag entries', () => {
      const isLive = false;
      render(
        <EntityHeader
          title={{
            label: 'Session',
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
    it('renders a stat value as a link when a destination is given', () => {
      render(
        <EntityHeader
          title={{label: 'Session'}}
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

      expect(screen.getByRole('link', {name: '4'})).toHaveAttribute(
        'href',
        '/replays/1/?t_main=breadcrumbs'
      );
      expect(screen.getByText('Rage Clicks')).toBeInTheDocument();
      expect(screen.queryByRole('link', {name: '0'})).not.toBeInTheDocument();
    });

    it('explains a stat label through a tooltip without restyling it', async () => {
      render(
        <EntityHeader
          title={{label: 'Session'}}
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
          title={{label: 'Session'}}
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

      // The row itself stays a single number.
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.queryByText('javascript')).not.toBeInTheDocument();

      await userEvent.hover(screen.getByText('3'));
      expect(await screen.findByText('javascript')).toBeInTheDocument();
      expect(screen.getByText('python')).toBeInTheDocument();
    });

    it('keeps a linked value as a link, with the tooltip attached to it', async () => {
      render(
        <EntityHeader
          title={{label: 'Session'}}
          stats={[
            {
              type: 'link',
              label: 'Errors',
              value: 3,
              to: '/replays/1/?t_main=errors',
              valueTooltip: 'From 2 projects',
            },
          ]}
        />
      );

      const link = screen.getByRole('link', {name: '3'});
      expect(link).toHaveAttribute('href', '/replays/1/?t_main=errors');

      // The link is the only tab stop — InfoText would add a second one inside
      // the anchor — so the tooltip draws the underline onto the link itself.
      expect(link).toHaveStyle({textDecoration: 'underline'});

      await userEvent.hover(link);
      expect(await screen.findByText('From 2 projects')).toBeInTheDocument();
    });

    it('keeps the same element when a link stat receives its value', () => {
      // The type is declared, so a count arriving cannot turn a span into an
      // anchor. React keeps the node, nothing is re-laid out, and the row holds
      // still — which is the whole reason `type` is not inferred from `to`.
      const {rerender} = render(
        <EntityHeader
          title={{label: 'Session'}}
          stats={[
            {type: 'link', label: 'Errors', value: 0, to: '/replays/1/?t_main=errors'},
          ]}
        />
      );
      const before = screen.getByRole('link', {name: '0'});

      rerender(
        <EntityHeader
          title={{label: 'Session'}}
          stats={[
            {type: 'link', label: 'Errors', value: 3, to: '/replays/1/?t_main=errors'},
          ]}
        />
      );

      expect(screen.getByRole('link', {name: '3'})).toBe(before);
    });

    it('gives a linked value the same metrics as an unlinked one', () => {
      // The two types sit side by side in one row, so they have to agree on
      // their box. `Link` emits text-box-trim but no font size, so an anchor
      // wrapping the value would be trimmed to the font it inherits from the
      // row rather than the stat's own.
      const {rerender} = render(
        <EntityHeader
          title={{label: 'Session'}}
          stats={[{type: 'text', label: 'Errors', value: 3}]}
        />
      );
      const hasStatFontSize = (element: HTMLElement) =>
        getEmotionRules(element).some(rule => /font-size:\s*16px/.test(rule));

      expect(hasStatFontSize(screen.getByText('3'))).toBe(true);

      rerender(
        <EntityHeader
          title={{label: 'Session'}}
          stats={[
            {type: 'link', label: 'Errors', value: 3, to: '/replays/1/?t_main=errors'},
          ]}
        />
      );

      // The anchor itself carries the stat's type, rather than wrapping an
      // element that does.
      expect(hasStatFontSize(screen.getByRole('link', {name: '3'}))).toBe(true);
    });

    it('drops null entries so callers can inline conditionals', () => {
      const isVideoReplay = true;
      render(
        <EntityHeader
          title={{label: 'Session'}}
          stats={[
            isVideoReplay
              ? null
              : {type: 'text' as const, label: 'Dead Clicks', value: 4},
            {type: 'text', label: 'Errors', value: 2},
          ]}
          metadata={[
            {label: 'Chrome 144'},
            isVideoReplay ? null : {label: 'Windows >=10'},
          ]}
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
            title={{label: 'Session'}}
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

      // Typing into the later stat gives it observable state. If it were keyed by
      // position in the filtered array, the earlier stat appearing would remount
      // it and that state would be lost.
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
          title={{label: 'Session'}}
          people={{users: [], isLoading: true, label: 'Viewed by'}}
          stats={[{type: 'text', label: 'Errors', value: 2}]}
        />
      );

      // People load on their own schedule. Reserving the space is what stops the
      // stats shifting sideways when they land.
      expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();

      rerender(
        <EntityHeader
          title={{label: 'Session'}}
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
          title={{label: 'Session'}}
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

    it('renders nothing for people once they resolve to nobody', () => {
      render(
        <EntityHeader
          title={{label: 'Session'}}
          people={{users: [], label: 'Viewed by'}}
          stats={[{type: 'text', label: 'Errors', value: 2}]}
        />
      );

      expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
      // Nobody means no leading divider before the first stat.
      expect(screen.getByRole('banner').querySelectorAll('hr')).toHaveLength(0);
    });

    it('renders a tooltip on a metadata item', async () => {
      render(
        <EntityHeader
          title={{label: 'Session'}}
          metadata={[{label: 'TTFB', tooltip: 'Time to First Byte'}]}
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
          title={{label: 'Session'}}
          subtitle="A subtitle"
          stats={[
            {type: 'text', label: 'Dead Clicks', value: 4},
            {type: 'text', label: 'Errors', value: 2},
          ]}
          metadata={[{label: 'Chrome 144'}, {label: 'Windows >=10'}]}
        />
      );

      // title + subtitle + 2 stats + 2 metadata
      expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(6);

      // Every slot is fully replaced, labels included — a half-drawn stat beside a
      // loading title and metadata row reads as broken.
      expect(screen.queryByText('Dead Clicks')).not.toBeInTheDocument();
      expect(screen.queryByText('Errors')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', {level: 2})).not.toBeInTheDocument();
      expect(screen.queryByText('A subtitle')).not.toBeInTheDocument();
    });

    it('shows the people skeleton alongside the stats, not after them', () => {
      // People cannot be fetched until the entity resolves and yields its
      // project. If the slot only appeared once its own request was in flight,
      // its skeleton would start just as the stats beside it finished — reading
      // as two loads in sequence rather than one.
      const {rerender} = render(
        <EntityHeader
          isLoading
          title={{label: 'Session'}}
          people={{users: [], label: 'Viewed by'}}
          stats={[{type: 'text', label: 'Errors', value: 2}]}
        />
      );

      // title + stat + people
      expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(3);

      // The entity lands, its people request starts, and the avatar slot holds.
      rerender(
        <EntityHeader
          title={{label: 'Session'}}
          people={{users: [], isLoading: true, label: 'Viewed by'}}
          stats={[{type: 'text', label: 'Errors', value: 2}]}
        />
      );

      expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(1);
      expect(screen.getByText('Errors')).toBeInTheDocument();
    });
  });

  describe('layout', () => {
    it('pins the stat height so an async value cannot shift the rows below', () => {
      // A viewer avatar list and an error count are both taller than the text
      // they replace, and they land at different times. If the stat grew to fit
      // them, every row beneath would move as each query settled.
      const {rerender} = render(
        <EntityHeader
          isLoading
          title={{label: 'Session'}}
          stats={[{type: 'text', label: 'Seen By', value: null}]}
          metadata={[{label: 'Chrome 144'}]}
        />
      );

      const skeleton = screen.getAllByTestId('loading-placeholder')[1]!;
      expect(
        getEmotionRules(skeleton.parentElement!).some(r => /height:\s*32px/.test(r))
      ).toBe(true);

      rerender(
        <EntityHeader
          title={{label: 'Session'}}
          stats={[
            {
              type: 'text',
              label: 'Seen By',
              value: <img alt="" height={25} width={50} />,
            },
          ]}
          metadata={[{label: 'Chrome 144'}]}
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
          title={{label: 'Session'}}
          stats={[{type: 'text', label: 'Errors', value: 2}]}
          metadata={[{label: 'Chrome 144'}]}
        />
      );

      const rules = getGridRules();

      // Base (narrow): stats come last, on their own row.
      expect(
        rules.some(
          r =>
            !r.includes('@container') &&
            /grid-template-areas:\s*"title"\s*"context"\s*"stats"/.test(r)
        )
      ).toBe(true);

      // Wide: stats move up beside the title, at the width where the two first
      // fit rather than at the spec's nominal band edge.
      expect(
        rules.some(
          r =>
            /@container[^{]*min-width:\s*640px/.test(r) &&
            /grid-template-areas:\s*"title stats"\s*"context context"/.test(r)
        )
      ).toBe(true);

      // Regression guard: the reflow must be driven by the container's width, not
      // an always-matching viewport media query that would shadow it.
      expect(
        rules.some(
          r => /@media[^{]*min-width:\s*0px/.test(r) && r.includes('grid-template-areas')
        )
      ).toBe(false);
    });

    it('emits no row for a slot that was not supplied', () => {
      const {rerender} = render(<EntityHeader title={{label: 'Session'}} />);

      // An area declared with no item in it still creates a row, and `gap` still
      // applies around it — so an omitted slot must not appear in the template.
      let rules = getGridRules();
      expect(rules.some(r => /grid-template-areas:\s*"title"\s*;/.test(r))).toBe(true);
      expect(rules.some(r => r.includes('context'))).toBe(false);
      expect(rules.some(r => r.includes('stats'))).toBe(false);

      rerender(
        <EntityHeader title={{label: 'Session'}} metadata={[{label: 'Chrome 144'}]} />
      );

      rules = getGridRules();
      expect(rules.some(r => /grid-template-areas:\s*"title"\s*"context"/.test(r))).toBe(
        true
      );
      expect(rules.some(r => r.includes('stats'))).toBe(false);
    });
  });
});
