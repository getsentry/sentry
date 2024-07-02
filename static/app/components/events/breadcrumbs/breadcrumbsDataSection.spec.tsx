import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import BreadcrumbsDataSection from 'sentry/components/events/breadcrumbs/breadcrumbsDataSection';
import {EntryType} from 'sentry/types';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';

const virtualCrumbTitle = 'Sentry Event!';
const initialTimestamp = 10000000;
const breadcrumbs = [
  {
    message: 'first',
    category: 'Some Warning',
    level: BreadcrumbLevelType.WARNING,
    type: BreadcrumbType.INFO,
    timestamp: new Date(initialTimestamp).toISOString(),
  },
  {
    message: 'log',
    category: 'Log',
    level: BreadcrumbLevelType.LOG,
    type: BreadcrumbType.INFO,
    timestamp: new Date(initialTimestamp).toISOString(),
  },
  {
    message: 'request',
    category: 'Request',
    level: BreadcrumbLevelType.INFO,
    type: BreadcrumbType.NAVIGATION,
    timestamp: new Date(initialTimestamp).toISOString(),
  },
  {
    message: 'sql',
    category: 'Query',
    level: BreadcrumbLevelType.INFO,
    type: BreadcrumbType.QUERY,
    timestamp: new Date(initialTimestamp).toISOString(),
  },
];
const breacrumbEntry = {
  type: EntryType.BREADCRUMBS,
  data: {
    values: breadcrumbs,
  },
};
const exceptionEntry = {
  type: EntryType.EXCEPTION,
  data: {
    values: [
      {
        value: virtualCrumbTitle,
      },
    ],
  },
};

describe('BreadcrumbsDataSection', function () {
  const event = EventFixture({
    entries: [breacrumbEntry, exceptionEntry],
  });
  const project = ProjectFixture();
  const group = GroupFixture();

  it('renders a summary of breadcrumbs with a button to view them all', async function () {
    render(<BreadcrumbsDataSection event={event} group={group} project={project} />);

    // Only summary crumbs should be visible by default
    const summaryCrumbTitles = [
      'Exception',
      breadcrumbs[3].category,
      breadcrumbs[2].category,
    ];
    for (const crumbTitle of summaryCrumbTitles) {
      expect(screen.getByText(crumbTitle)).toBeInTheDocument();
    }
    const hiddenCrumbTitles = [breadcrumbs[1].category, breadcrumbs[0].category];
    for (const crumbTitle of hiddenCrumbTitles) {
      expect(screen.queryByText(crumbTitle)).not.toBeInTheDocument();
    }

    // When expanded, all should be visible
    const viewAllButton = screen.getByRole('button', {name: 'View All Breadcrumbs'});
    await userEvent.click(viewAllButton);
    const drawer = screen.getByRole('complementary', {name: 'breadcrumb drawer'});
    expect(drawer).toBeInTheDocument();
    for (const crumbTitle of [...summaryCrumbTitles, ...hiddenCrumbTitles]) {
      expect(within(drawer).getByText(crumbTitle)).toBeInTheDocument();
    }
  });

  it('can switch between display time formats', async function () {
    const singleCrumbEvent = EventFixture({
      entries: [
        {
          type: EntryType.BREADCRUMBS,
          data: {
            values: [breadcrumbs[0]],
          },
        },
        exceptionEntry,
      ],
    });
    render(
      <BreadcrumbsDataSection event={singleCrumbEvent} group={group} project={project} />
    );

    // From virtual crumb
    expect(screen.getByText('0ms')).toBeInTheDocument();
    expect(screen.queryByText('18:01:48')).not.toBeInTheDocument();
    // From event breadcrumb
    expect(screen.getByText('-593mo')).toBeInTheDocument();
    expect(screen.queryByText('02:46:39')).not.toBeInTheDocument();

    const control = screen.getByRole('button', {
      name: `Change Time Format for Breadcrumbs`,
    });
    await userEvent.click(control);

    expect(screen.queryByText('0ms')).not.toBeInTheDocument();
    expect(screen.getByText('18:01:48')).toBeInTheDocument();
    expect(screen.queryByText('-593mo')).not.toBeInTheDocument();
    expect(screen.getByText('02:46:40')).toBeInTheDocument();

    await userEvent.click(control);

    expect(screen.getByText('0ms')).toBeInTheDocument();
    expect(screen.queryByText('18:01:48')).not.toBeInTheDocument();
    expect(screen.getByText('-593mo')).toBeInTheDocument();
    expect(screen.queryByText('02:46:39')).not.toBeInTheDocument();
  });

  it.each([
    {action: 'Search', elementRole: 'textbox'},
    {action: 'Filter', elementRole: 'button'},
    {action: 'Sort', elementRole: 'button'},
  ])(
    'opens the drawer, and focuses $action $elementRole when $action button is pressedb',
    async ({action, elementRole}) => {
      render(<BreadcrumbsDataSection event={event} group={group} project={project} />);

      const control = screen.getByRole('button', {name: `${action} Breadcrumbs`});
      expect(control).toBeInTheDocument();
      await userEvent.click(control);
      expect(
        screen.getByRole('complementary', {name: 'breadcrumb drawer'})
      ).toBeInTheDocument();
      const drawerControl = screen.getByRole(elementRole, {
        name: `${action} All Breadcrumbs`,
      });
      expect(drawerControl).toBeInTheDocument();
      expect(drawerControl).toHaveFocus();
    }
  );
});
