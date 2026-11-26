import {useState} from 'react';
import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import {
  getMonitorScopeProjects,
  getServiceAccountProjectIds,
  ProjectSelector,
  type ProjectSelection,
} from './serviceAccountAccess';

type SelectorProps = React.ComponentProps<typeof ProjectSelector>;

// The selector is controlled, so this holds its value the way a form field would
function ExampleSelector({
  initialValue,
  ...props
}: Partial<SelectorProps> & {initialValue: ProjectSelection}) {
  const [value, setValue] = useState(initialValue);
  return (
    <ProjectSelector
      disabled={false}
      emptyMessage="No projects added"
      {...props}
      value={value}
      onChange={setValue}
    />
  );
}

describe('ProjectSelector', () => {
  // Owners reach every project, members only their own
  const organization = OrganizationFixture({orgRole: 'owner'});
  const memberOrganization = OrganizationFixture({orgRole: 'member'});

  beforeEach(() => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'checkout-api'}),
      ProjectFixture({id: '2', slug: 'payments-worker'}),
    ]);
  });

  it('shows why each project is included by default', () => {
    render(<ExampleSelector initialValue={{allProjects: false, projectIds: ['1']}} />, {
      organization,
    });

    expect(screen.getByText('Included because')).toBeInTheDocument();
    expect(screen.getByText('Added manually')).toBeInTheDocument();
  });

  it('hides the reason when asked to', async () => {
    render(
      <ExampleSelector
        showReason={false}
        initialValue={{allProjects: false, projectIds: ['1']}}
      />,
      {organization}
    );

    expect(screen.getByText('checkout-api')).toBeInTheDocument();
    expect(screen.queryByText('Included because')).not.toBeInTheDocument();
    expect(screen.queryByText('Added manually')).not.toBeInTheDocument();

    // Projects can still be removed
    await userEvent.click(screen.getByRole('button', {name: 'Remove checkout-api'}));
    expect(screen.getByText('No projects added')).toBeInTheDocument();
  });

  it('lists every project as removable without a scope', () => {
    render(
      <ExampleSelector initialValue={{allProjects: false, projectIds: ['1', '2']}} />,
      {organization}
    );

    expect(screen.getByText('2 projects')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Remove checkout-api'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Remove payments-worker'})).toBeEnabled();
  });

  it('locks the projects in the automation scope', async () => {
    render(
      <ExampleSelector
        scopeProjects={{allProjects: false, projectIds: ['1']}}
        initialValue={{allProjects: false, projectIds: ['2']}}
      />,
      {organization}
    );

    expect(screen.getByText('2 projects · 1 from automation scope')).toBeInTheDocument();
    expect(screen.getByText('Automation scope')).toBeInTheDocument();
    expect(screen.getByText('Added manually')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Remove checkout-api'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Remove payments-worker'})).toBeEnabled();

    await userEvent.hover(
      screen.getByRole('button', {name: 'checkout-api is included by automation scope'})
    );
    expect(await screen.findByText('Included by automation scope')).toBeInTheDocument();
  });

  it('describes locked projects by their monitors for a monitor scope', async () => {
    render(
      <ExampleSelector
        isMonitorScoped
        scopeProjects={{allProjects: false, projectIds: ['1']}}
        initialValue={{allProjects: false, projectIds: ['2']}}
      />,
      {organization}
    );

    expect(
      screen.getByText('2 projects · 1 from connected monitors')
    ).toBeInTheDocument();
    expect(screen.getByText('Connected Monitors')).toBeInTheDocument();
    expect(screen.queryByText('Automation scope')).not.toBeInTheDocument();

    await userEvent.hover(
      screen.getByRole('button', {
        name: 'checkout-api is included by its connected monitors',
      })
    );
    expect(
      await screen.findByText('Included by its connected monitors')
    ).toBeInTheDocument();
  });

  it('forces all projects for an all-projects scope', () => {
    render(
      <ExampleSelector
        scopeProjects={{allProjects: true, projectIds: []}}
        initialValue={{allProjects: false, projectIds: ['2']}}
      />,
      {organization}
    );

    const allProjects = screen.getByRole('checkbox', {name: 'All projects'});
    expect(allProjects).toBeChecked();
    expect(allProjects).toBeDisabled();
    // The project list gives way to all projects
    expect(screen.queryByRole('button', {name: 'Add projects'})).not.toBeInTheDocument();
    expect(screen.queryByText('payments-worker')).not.toBeInTheDocument();
  });

  it('only lets roles with all-project access toggle all projects', async () => {
    const {unmount} = render(
      <ExampleSelector initialValue={{allProjects: false, projectIds: ['1']}} />,
      {organization: memberOrganization}
    );
    expect(screen.getByRole('checkbox', {name: 'All projects'})).toBeDisabled();
    unmount();

    render(<ExampleSelector initialValue={{allProjects: false, projectIds: ['1']}} />, {
      organization,
    });
    await userEvent.click(screen.getByRole('checkbox', {name: 'All projects'}));
    expect(screen.getByRole('checkbox', {name: 'All projects'})).toBeChecked();
  });
});

describe('getServiceAccountProjectIds', () => {
  it('combines scope and manually added projects in ID order', () => {
    expect(
      getServiceAccountProjectIds(
        {allProjects: false, projectIds: ['10', '2']},
        {allProjects: false, projectIds: ['3', '2']}
      )
    ).toEqual(['2', '3', '10']);
  });

  it('returns only the manually added projects without a scope', () => {
    expect(getServiceAccountProjectIds({allProjects: false, projectIds: ['2']})).toEqual([
      '2',
    ]);
  });

  it('lists no projects when the account or the scope covers all projects', () => {
    expect(
      getServiceAccountProjectIds(
        {allProjects: true, projectIds: ['1']},
        {allProjects: false, projectIds: ['2']}
      )
    ).toEqual([]);
    expect(
      getServiceAccountProjectIds(
        {allProjects: false, projectIds: ['1']},
        {allProjects: true, projectIds: ['2']}
      )
    ).toEqual([]);
  });
});

describe('getMonitorScopeProjects', () => {
  it('scopes to each monitor project once, never to all projects', () => {
    expect(
      getMonitorScopeProjects([
        MetricDetectorFixture({id: '1', projectId: '1'}),
        MetricDetectorFixture({id: '2', projectId: '1'}),
        MetricDetectorFixture({id: '3', projectId: '2'}),
      ])
    ).toEqual({allProjects: false, projectIds: ['1', '2']});
    expect(getMonitorScopeProjects([])).toEqual({allProjects: false, projectIds: []});
  });
});
