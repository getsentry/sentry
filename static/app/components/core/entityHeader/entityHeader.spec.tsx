import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {Tag} from '@sentry/scraps/badge';
import {EntityHeader} from '@sentry/scraps/entityHeader';

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
      // The label carries the meaning; the graphic is decorative.
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
            {label: 'Dead Clicks', value: 4, to: '/replays/1/?t_main=breadcrumbs'},
            {label: 'Rage Clicks', value: 0},
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

    it('drops null entries so callers can inline conditionals', () => {
      const isVideoReplay = true;
      render(
        <EntityHeader
          title={{label: 'Session'}}
          stats={[
            isVideoReplay ? null : {label: 'Dead Clicks', value: 4},
            {label: 'Errors', value: 2},
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
              showViewers ? {label: 'Seen By', value: <span>2 viewers</span>} : null,
              {
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

    it('holds space for viewers while they load, then renders the avatars', () => {
      const users = [UserFixture({id: '1', name: 'Alice', email: 'alice@example.com'})];

      const {rerender} = render(
        <EntityHeader
          title={{label: 'Session'}}
          viewers={{users: [], isLoading: true}}
          stats={[{label: 'Errors', value: 2}]}
        />
      );

      // Viewers load on their own schedule. Reserving the space is what stops the
      // stats shifting sideways when they land.
      expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();

      rerender(
        <EntityHeader
          title={{label: 'Session'}}
          viewers={{users}}
          stats={[{label: 'Errors', value: 2}]}
        />
      );

      expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
      expect(screen.getByText('Errors')).toBeInTheDocument();
    });

    it('renders nothing for viewers once they resolve to nobody', () => {
      render(
        <EntityHeader
          title={{label: 'Session'}}
          viewers={{users: []}}
          stats={[{label: 'Errors', value: 2}]}
        />
      );

      expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
      // No viewers means no leading divider before the first stat.
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
            {label: 'Dead Clicks', value: 4},
            {label: 'Errors', value: 2},
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
          stats={[{label: 'Seen By', value: null}]}
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
          stats={[{label: 'Seen By', value: <img alt="" height={25} width={50} />}]}
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
          stats={[{label: 'Errors', value: 2}]}
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
