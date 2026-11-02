import {useEffect, useEffectEvent, useRef} from 'react';
import * as Sentry from '@sentry/react';

import {InfoTip} from '@sentry/scraps/info';

import {fetchTotalCount} from 'sentry/actionCreators/events';
import type {EventsChartProps} from 'sentry/components/charts/eventsChart';
import {EventsChart} from 'sentry/components/charts/eventsChart';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {t} from 'sentry/locale';
import type {PageFilters, PageFilterDatetime} from 'sentry/types/core';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getDynamicText} from 'sentry/utils/getDynamicText';
import {withPageFilters} from 'sentry/utils/withPageFilters';

type Props = Omit<
  EventsChartProps,
  keyof Omit<PageFilters, 'datetime'> | keyof PageFilterDatetime
> & {
  onTotalValuesChange: (value: number | null) => void;
  selection: PageFilters;
  title: string;
  yAxis: string;
  help?: string;
};

function ProjectBaseEventsChart(props: Props) {
  const {
    location,
    organization,
    selection,
    api,
    yAxis,
    query,
    field,
    title,
    help,
    dataset = DiscoverDatasets.SPANS,
    onTotalValuesChange,
    ...eventsChartProps
  } = props;
  const {projects, environments, datetime} = selection;
  const {start, end, period, utc} = datetime;

  const selectionKey = getSelectionKey(selection);

  // Tracks the most recent request by identity (not just by selection key, as
  // the same selection can be requested again, e.g. A -> B -> A), so that stale
  // responses, or responses arriving after unmount, are ignored.
  const latestRequestRef = useRef<{selectionKey: string} | null>(null);

  // Effect event so the latest props are read without re-running the effect;
  // the total count is only re-fetched when the page filter selection changes.
  const fetchTotals = useEffectEvent((requestSelectionKey: string) => {
    const request = {selectionKey: requestSelectionKey};
    latestRequestRef.current = request;

    fetchTotalCount(api, organization.slug, {
      field: [],
      query,
      dataset,
      environment: environments,
      project: projects.map(String),
      ...normalizeDateTimeParams(datetime),
    })
      .then(totals => {
        if (latestRequestRef.current === request) {
          onTotalValuesChange(totals);
        }
      })
      .catch(err => {
        if (latestRequestRef.current === request) {
          onTotalValuesChange(null);
        }
        Sentry.captureException(err);
      });
  });

  useEffect(() => {
    fetchTotals(selectionKey);
    return () => {
      latestRequestRef.current = null;
    };
  }, [selectionKey]);

  return getDynamicText({
    value: (
      <EventsChart
        {...eventsChartProps}
        location={location}
        organization={organization}
        showLegend
        yAxis={yAxis}
        query={query}
        api={api}
        projects={projects}
        dataset={dataset}
        environments={environments}
        start={start}
        end={end}
        period={period}
        utc={utc}
        field={field}
        currentSeriesName={t('This Period')}
        previousSeriesName={t('Previous Period')}
        disableableSeries={[t('This Period'), t('Previous Period')]}
        chartHeader={
          <HeaderTitleLegend>
            {title}
            {help && <InfoTip size="sm" position="top" title={help} />}
          </HeaderTitleLegend>
        }
        legendOptions={{right: 10, top: 0}}
        chartOptions={{
          grid: {left: '10px', right: '10px', top: '40px', bottom: '0px'},
          yAxis: {
            axisLabel: {
              formatter: (value: number) =>
                axisLabelFormatter(value, aggregateOutputType(yAxis)),
            },
            scale: true,
          },
        }}
      />
    ),
    fixed: `${title} Chart`,
  });
}

/**
 * Build a stable key from the non-utc values of a selection.
 * Useful when re-fetching data based on page filters changing.
 *
 * utc is not included as there is a problem somewhere in the selection
 * data flow that results in it being undefined | null | boolean instead of null | boolean.
 * Datetimes are stringified as we aren't interested in their identity.
 */
function getSelectionKey(selection: PageFilters): string {
  return JSON.stringify([
    selection.projects,
    selection.environments,
    selection.datetime.period,
    selection.datetime.start?.toString(),
    selection.datetime.end?.toString(),
  ]);
}

export default withPageFilters(ProjectBaseEventsChart);


<GENERAL RULES RELEVANT TO THIS FILE>

<general_rules>
Here are some rules that you should follow. Please ignore any rules that are not relevant to the current task, or that ask you to run code (as you are unable to do so):
### Rule
@AGENTS.md
### Rule
# Frontend Development Guide

> For critical commands and testing rules, see the "Command Execution Guide" section in `/AGENTS.md` in the repository root.

## Frontend Tech Stack

- **Language**: TypeScript
- **Framework**: React 19
- **Build Tool**: Rsbuild (powered by Rspack)
- **Package management**: pnpm
- **State Management**: Reflux, React Query (TanStack Query)
- **Styling**: Emotion (CSS-in-JS), Less
- **Testing**: Jest, React Testing Library

## Important Files and Directories

- `package.json`: Node.js dependencies and scripts
- `rsbuild.config.ts`: Frontend build configuration
- `tsconfig.json`: TypeScript configuration
- `oxlint.config.ts`: Oxlint configuration
- `stylelint.config.js`: CSS/styling linting
- **Components**: `static/app/components/{component}/`
- **Views**: `static/app/views/{area}/{page}.tsx`
- **Stores**: `static/app/stores/{store}Store.tsx`
- **Actions**: `static/app/actionCreators/{resource}.tsx`
- **Utils**: `static/app/utils/{utility}.tsx`
- **Types**: `static/app/types/{area}.tsx`
- **API Client**: `static/app/api.tsx`

### Routing

- Routes defined in `static/app/router/routes.tsx`
- Local development and deploy previews run React Router V8. Production remains
  on V6. Application tests and typechecks run against both versions; set
  `SENTRY_REACT_ROUTER_VERSION=6` or `8` to run `test-ci` or `typecheck` against one.
  `build-utils/react-router.ts` selects the build runtime and Nuqs adapter together.
- Use V8 import paths: import router APIs and types from `react-router`, and
  `RouterProvider` from `react-router/dom`. These paths are aliased to the V6
  runtime through `static/app/utils/reactRouterV6` in V6 builds.
- Only the compatibility modules may import `react-router-dom` or
  `@remix-run/router` directly. Keep using Sentry's routing helpers where required.
  Use Sentry's version-neutral router tracing integration and wrapper. Keep the
  Nuqs V6 adapter import; V8 builds and tests alias it to the V8 adapter.
- Lazy load route components when possible

### Frontend API Calls

Use `apiOptions` with `useQuery` from TanStack Query; **never** use the deprecated `useApiQuery`/`getApiQueryData`/`setApiQueryData`. `staleTime` is required. For the full guide (conditional fetching, no call-site generics, response headers/pagination) → use the **`frontend-data-fetching`** skill.

## General Frontend Rules

1. NO new Reflux stores
2. NO class components
3. NO CSS files (use [core components](./app/components/core/) or Emotion in edge cases)
4. ALWAYS use TypeScript
5. ALWAYS colocate tests
6. Lazy load routes: `React.lazy(() => import('...'))`

## Linting

Incubator rules show as warnings in editors but fail `pnpm run lint:js`, prek, and CI. `oxlint-suppressions.json` caps existing debt per file and rule, and successful fixes lower its counts automatically. Run `pnpm run lint:js --help` for the suppression maintenance flags (`--prune`, `--enroll`, `--backlog`).

## Refs

**NEVER read from or write to a ref (`ref.current`) during render.** This breaks the rules of React — render must be pure, and refs are mutable state that React does not track. Reading a ref during render can return stale values across concurrent renders; writing one is a side effect that makes render impure.

- Read and write `ref.current` **only** inside effects (`useEffect`, `useLayoutEffect`) or event handlers/callbacks — never in the render body.
- If you need a value during render, derive it as a `const` from props/state, or lift it into `useState`/`useMemo`. Reach for a ref only for values that must persist across renders **without** triggering one (DOM nodes, timers, previous-value tracking read later in an effect).

```tsx
// ❌ Reading/writing a ref during render
function Component({value}: Props) {
  renderCountRef.current += 1; // side effect during render
  const previous = prevValueRef.current; // stale under concurrent rendering
  prevValueRef.current = value; // write during render
  return <div>{previous}</div>;
}

// ✅ Mutate refs in effects; derive render values
function Component({value}: Props) {
  const prevValueRef = useRef(value);
  useEffect(() => {
    prevValueRef.current = value; // write in an effect
  }, [value]);
  return <div>{value}</div>;
}
```

## UI Patterns

- When implementing advanced copy to clipboard functionality like markdown or JSON, avoid using separate buttons to copy different formats and prefer using sentry/components/copyAsDropdown and provide the different format options.

## Design System

Use core primitives from `@sentry/scraps` instead of hand-rolling styled components for layout and typography. **For the full prop/token reference and worked examples, use the `design-system` skill.**

- **Layout**: use `Flex`, `Grid`, `Stack`, `Container` — never styled `display: flex/grid`.
- **Typography**: use `Text` and `Heading` — never raw `<p>`, `<span>`, `<div>`, or `<h1>`–`<h6>`.
- Prefer component props over the `style` attribute; use `gap`/padding over `margin`.
- Use responsive props (e.g. `{xs: 'column', md: 'row'}`) instead of styled media queries.
- Split layout from typography — compose `Flex`/`Grid` with `Text`/`Heading`; don't couple them in one styled component.
- Prefer `InfoTip`/`InfoText` over a raw `Tooltip`.
- Add `*.stories.mdx` stories for new components.
- Use [core components](./app/components/core/) whenever available; reserve Emotion for genuine edge cases.

### Other core components

- **Avatars**: use `<UserAvatar/>`/`<TeamAvatar/>`/`<ProjectAvatar/>`/etc. from `static/app/components/core/avatar` (and `<AvatarList>` for lists) — never raw `<img>`.
- **Disclosure**: use the core `<Disclosure>` component — don't hand-roll expand/collapse.
- **Icons**: import SVG icons from explicit `@sentry/icons` subpaths (for example, `@sentry/icons/add`). Keep SvgIcon-based icons in `static/packages/icons/src`; keep app asset wrappers in `static/app/icons`. The icons package must not depend on scraps or app code. Never inline SVGs. Optimize with svgo/svgomg.
- **Images**: import via the `sentry-images` alias (webpack loader); keep them in `static/app/images`, never reference by static path.

For worked examples of all of the above, use the **`design-system`** skill.

## React Testing

Writing or editing frontend tests (`*.spec.tsx`, RTL, `MockApiClient`, routing/network tests) → use the **`react-testing`** skill for the full guide (query priority, no hook mocking, fixtures, async assertions, mocking network requests).

## Sentry SDK Instrumentation

Before inventing a key for `Sentry.setTag`/`setContext`, or a span's `setAttribute`, check whether OTel or Sentry already has a standard name for it in `@sentry/conventions`. Reuse existing names so the same attribute remains queryable across producers such as SDKs and Relay.

Find attribute name constants in `@sentry/conventions/attributes/search`, where they are prefixed with `SEARCH_`. Use `span.setAttribute` to attach the value with the existing convention name:

```tsx
import {SEARCH_USER_AGENT__ORIGINAL} from '@sentry/conventions/attributes/search';

span.setAttribute(SEARCH_USER_AGENT__ORIGINAL, navigator.userAgent);
```
</general_rules>

</GENERAL RULES RELEVANT TO THIS FILE>
