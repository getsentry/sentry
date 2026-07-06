import {Fragment} from 'react';

import {Container} from '@sentry/scraps/layout';
import {LeadingGraphics} from '@sentry/scraps/leadingGraphics';

import {BreadcrumbList} from 'sentry/components/breadcrumbs';
import {IconSettings, IconStar} from 'sentry/icons';
import * as Storybook from 'sentry/stories';

export const documentation =
  import('!!type-loader!sentry/components/breadcrumbs/breadcrumbList');

export default Storybook.story('BreadcrumbList', story => {
  story('Basic usage', () => (
    <Fragment>
      <p>
        <Storybook.JSXNode name="BreadcrumbList" /> renders a typed breadcrumb trail. Pass
        a discriminated <Storybook.JSXProperty name="items" value="BreadcrumbItem[]" />{' '}
        array where each entry has an explicit{' '}
        <Storybook.JSXProperty name="type" value="string" /> — <code>'link'</code>,{' '}
        <code>'page-title'</code>, or <code>'select-projects'</code>. The last item is
        typically the current page title.
      </p>
      <Storybook.SizingWindow display="block">
        <BreadcrumbList
          items={[
            {type: 'link', props: {label: 'Organization', to: '/organizations/sentry/'}},
            {
              type: 'link',
              props: {label: 'Projects', to: '/organizations/sentry/projects/'},
            },
            {
              type: 'link',
              props: {label: 'javascript', to: '/settings/sentry/projects/javascript/'},
            },
            {type: 'page-title', props: {label: 'General Settings'}},
          ]}
        />
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('With leading graphics', () => (
    <Fragment>
      <p>
        Both <code>'link'</code> and <code>'page-title'</code> items accept an optional{' '}
        <Storybook.JSXProperty name="leadingGraphic" value="ReactNode" /> rendered before
        the label. Pass a <Storybook.JSXNode name="LeadingGraphics" /> node for platform
        icons, sentry icons, or avatars.
      </p>
      <Storybook.SizingWindow display="block">
        <BreadcrumbList
          items={[
            {
              type: 'link',
              props: {
                label: 'Settings',
                to: '/settings/',
                leadingGraphic: (
                  <LeadingGraphics variant="icon" icon={<IconSettings size="xs" />} />
                ),
              },
            },
            {
              type: 'link',
              props: {
                label: 'javascript',
                to: '/settings/sentry/projects/javascript/',
                leadingGraphic: (
                  <LeadingGraphics
                    variant="badge-project"
                    projectPlatforms={['javascript']}
                  />
                ),
              },
            },
            {
              type: 'page-title',
              props: {
                label: 'Client Keys (DSN)',
                leadingGraphic: (
                  <LeadingGraphics variant="icon" icon={<IconStar size="xs" />} />
                ),
              },
            },
          ]}
        />
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('Page title with pagination and trailing actions', () => (
    <Fragment>
      <p>
        The <code>'page-title'</code> item supports an optional structured{' '}
        <Storybook.JSXProperty name="pagination" value="BreadcrumbItemPaginationProps" />{' '}
        slot (rendered before the label). Pass <code>previous</code> and <code>next</code>{' '}
        items — each with an <code>ariaLabel</code>, optional <code>to</code>/
        <code>onClick</code>, <code>disabled</code>, and <code>tooltip</code>. The two
        chevron buttons are rendered internally. A{' '}
        <Storybook.JSXProperty name="trailingActions" value="ReactNode" /> slot (up to
        52px) is also available after the label.
      </p>
      <Storybook.SizingWindow display="block">
        <BreadcrumbList
          items={[
            {type: 'link', props: {label: 'Issues', to: '/organizations/sentry/issues/'}},
            {
              type: 'page-title',
              props: {
                label: 'TypeError: Cannot read properties of undefined',
                pagination: {
                  previous: {ariaLabel: 'Previous issue', to: '/issues/122/'},
                  next: {ariaLabel: 'Next issue', to: '/issues/124/', disabled: true},
                },
                trailingActions: null,
              },
            },
          ]}
        />
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('Narrow overflow (container query)', () => (
    <Fragment>
      <p>
        When the container is narrower than 800px, all <code>'link'</code> parent items
        collapse into a single <code>…</code> overflow button. Resize the window or
        constrain the container to see this behaviour.
      </p>
      <Storybook.SideBySide>
        <Fragment>
          <p>Wide (≥ 800px — all items visible)</p>
          <Storybook.SizingWindow display="block">
            <BreadcrumbList
              items={[
                {type: 'link', props: {label: 'Settings', to: '/settings/'}},
                {
                  type: 'link',
                  props: {
                    label: 'javascript',
                    to: '/settings/sentry/projects/javascript/',
                  },
                },
                {
                  type: 'link',
                  props: {
                    label: 'Client Keys (DSN)',
                    to: '/settings/sentry/projects/javascript/keys/',
                  },
                },
                {type: 'page-title', props: {label: 'web-frontend-dsn'}},
              ]}
            />
          </Storybook.SizingWindow>
        </Fragment>
        <Fragment>
          <p>Narrow ({'<'} 800px — link parents collapse into …)</p>
          <Container maxWidth="400px">
            <BreadcrumbList
              items={[
                {type: 'link', props: {label: 'Settings', to: '/settings/'}},
                {
                  type: 'link',
                  props: {
                    label: 'javascript',
                    to: '/settings/sentry/projects/javascript/',
                  },
                },
                {
                  type: 'link',
                  props: {
                    label: 'Client Keys (DSN)',
                    to: '/settings/sentry/projects/javascript/keys/',
                  },
                },
                {type: 'page-title', props: {label: 'web-frontend-dsn'}},
              ]}
            />
          </Container>
        </Fragment>
      </Storybook.SideBySide>
    </Fragment>
  ));

  story('As nav element', () => (
    <Fragment>
      <p>
        Pass <Storybook.JSXProperty name="as" value="'nav'" /> to render the breadcrumb
        trail inside a semantic <code>{'<nav>'}</code> element with{' '}
        <code>aria-label="Breadcrumbs"</code>.
      </p>
      <Storybook.SizingWindow display="block">
        <BreadcrumbList
          as="nav"
          items={[
            {type: 'link', props: {label: 'Home', to: '/'}},
            {type: 'link', props: {label: 'Alerts', to: '/organizations/sentry/alerts/'}},
            {type: 'page-title', props: {label: 'Alert Rules'}},
          ]}
        />
      </Storybook.SizingWindow>
    </Fragment>
  ));
});
