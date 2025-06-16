import {Fragment} from 'react';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import * as Storybook from 'sentry/stories';

export default Storybook.story('Breadcrumbs', story => {
  story('Basics', () => (
    <Fragment>
      <p>
        <Storybook.JSXNode name="Breadcrumbs" /> displays a navigation path with clickable
        links. By default, the last item is not clickable to avoid linking to the current
        page.
      </p>
      <Storybook.SizingWindow display="block">
        <Breadcrumbs
          crumbs={[
            {label: 'Organization', to: '/organizations/sentry/'},
            {label: 'Projects', to: '/organizations/sentry/projects/'},
            {label: 'Project Settings', to: '/settings/projects/javascript/'},
            {label: 'General', to: null},
          ]}
        />
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('With Last Item Linked', () => (
    <Fragment>
      <p>
        Set <Storybook.JSXProperty name="linkLastItem" value /> to make the last
        breadcrumb clickable.
      </p>
      <Storybook.SizingWindow display="block">
        <Breadcrumbs
          linkLastItem
          crumbs={[
            {label: 'Organization', to: '/organizations/sentry/'},
            {label: 'Projects', to: '/organizations/sentry/projects/'},
            {label: 'All Projects', to: '/organizations/sentry/projects/all/'},
          ]}
        />
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('With Dropdown', () => (
    <Fragment>
      <p>
        Breadcrumbs can include dropdown menus for selecting between multiple options.
      </p>
      <Storybook.SizingWindow display="block" style={{minHeight: '250px'}}>
        <Breadcrumbs
          crumbs={[
            {label: 'Organization', to: '/organizations/sentry/'},
            {
              label: 'Select Project',
              items: [
                {index: 0, value: 'javascript', label: 'JavaScript Project'},
                {index: 1, value: 'python', label: 'Python Project'},
                {index: 2, value: 'react', label: 'React Project'},
              ],
              onSelect: item => {
                // eslint-disable-next-line no-console
                console.log('Selected:', item);
              },
            },
            {label: 'Settings', to: null},
          ]}
        />
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('Page Filter Preservation', () => (
    <Fragment>
      <p>
        Use <Storybook.JSXProperty name="preservePageFilters" value /> on individual
        crumbs to maintain project/environment/time filters when navigating.
      </p>
      <Storybook.SizingWindow display="block">
        <Breadcrumbs
          crumbs={[
            {
              label: 'Dashboard',
              to: '/organizations/sentry/dashboard/',
              preservePageFilters: true,
            },
            {
              label: 'Issues',
              to: '/organizations/sentry/issues/',
              preservePageFilters: true,
            },
            {label: 'Issue Detail', to: null},
          ]}
        />
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('Different Lengths', () => (
    <Fragment>
      <p>Examples of breadcrumb trails with different lengths.</p>
      <Storybook.SideBySide>
        {[
          [{label: 'Single Item', to: null}],
          [
            {label: 'Home', to: '/'},
            {label: 'Current Page', to: null},
          ],
          [
            {label: 'Organization', to: '/org/'},
            {label: 'Project', to: '/project/'},
            {label: 'Issues', to: '/issues/'},
            {label: 'Issue #123', to: null},
          ],
          [
            {
              label: 'longlonglonglonglonglonglonglonglonglonglonglonglonglonglong',
              to: '/org/',
            },
            {label: 'Very Long Project Name Here', to: '/project/'},
            {label: 'Settings', to: '/settings/'},
            {label: 'Performance', to: '/performance/'},
            {label: 'Detailed Configuration Page', to: null},
          ],
        ].map((crumbs, index) => (
          <Fragment key={index}>
            <p>
              {crumbs.length} item{crumbs.length === 1 ? '' : 's'}
            </p>
            <Storybook.SizingWindow display="block">
              <Breadcrumbs crumbs={crumbs} />
            </Storybook.SizingWindow>
          </Fragment>
        ))}
      </Storybook.SideBySide>
    </Fragment>
  ));
});
