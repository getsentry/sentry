import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import Form from 'sentry/components/forms/form';
import ProjectsStore from 'sentry/stores/projectsStore';

import {InstrumentationGuide} from './instrumentationGuide';

describe('InstrumentationGuide', () => {
  beforeEach(() => {
    ProjectsStore.reset();
  });

  it('renders the platform dropdown menu', () => {
    render(<InstrumentationGuide />);

    expect(screen.getByText('Select Instrumentation Method')).toBeInTheDocument();

    const dropdown = screen.getByRole('button', {name: 'Select Platform'});
    expect(dropdown).toBeInTheDocument();
  });

  it('hides "Manually Create a Monitor" button when no guide is selected', () => {
    render(<InstrumentationGuide />);

    expect(
      screen.queryByRole('button', {name: 'Manually Create a Monitor'})
    ).not.toBeInTheDocument();
  });

  it('opens dropdown menu and shows platform options', async () => {
    render(<InstrumentationGuide />);

    const dropdown = screen.getByRole('button', {name: 'Select Platform'});
    await userEvent.click(dropdown);

    const menu = await screen.findByRole('menu');
    expect(menu).toBeInTheDocument();

    // Generic section should be visible
    expect(screen.getByText('Generic')).toBeInTheDocument();
  });

  it('selects platform when clicking menu item', async () => {
    const {router} = render(<InstrumentationGuide />);

    const dropdown = screen.getByRole('button', {name: 'Select Platform'});
    await userEvent.click(dropdown);

    // Click on PHP (which has only one guide, so it should select directly)
    const phpOption = await screen.findByRole('menuitemradio', {name: 'PHP'});
    await userEvent.click(phpOption);

    // Verify query params were updated
    expect(router.location.query.platform).toBe('php');
    expect(router.location.query.guide).toBe('upsert');

    // Verify dropdown label updated
    expect(await screen.findByRole('button', {name: 'PHP - Upsert'})).toBeInTheDocument();
  });

  it('shows guide content after selecting a platform', async () => {
    render(<InstrumentationGuide />);

    // Initially no guide is shown
    expect(screen.queryByText(/Auto-Instrument with/)).not.toBeInTheDocument();

    const dropdown = screen.getByRole('button', {name: 'Select Platform'});
    await userEvent.click(dropdown);

    // Click on PHP
    const phpOption = await screen.findByRole('menuitemradio', {name: 'PHP'});
    await userEvent.click(phpOption);

    // Guide should now be visible
    expect(await screen.findByText('Auto-Instrument with PHP')).toBeInTheDocument();

    // Manual button should be visible
    expect(
      screen.getByRole('button', {name: 'Manually Create a Monitor'})
    ).toBeInTheDocument();
  });

  it('clears guide when clicking "Manually Create a Monitor"', async () => {
    render(<InstrumentationGuide />);

    // Select a platform first
    const dropdown = screen.getByRole('button', {name: 'Select Platform'});
    await userEvent.click(dropdown);

    const phpOption = await screen.findByRole('menuitemradio', {name: 'PHP'});
    await userEvent.click(phpOption);

    // Guide should be visible
    expect(await screen.findByText('Auto-Instrument with PHP')).toBeInTheDocument();

    // Click the manual button
    const manualButton = screen.getByRole('button', {
      name: 'Manually Create a Monitor',
    });
    await userEvent.click(manualButton);

    // Guide should be hidden
    expect(screen.queryByText('Auto-Instrument with PHP')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Manually Create a Monitor'})
    ).not.toBeInTheDocument();
  });

  describe('project based auto selection', () => {
    it('skips auto-selection when skipGuideDetection is true', () => {
      const nodeProject = ProjectFixture({id: '7', platform: 'node'});
      ProjectsStore.loadInitialData([nodeProject]);

      render(
        <Form initialData={{projectId: nodeProject.id}}>
          <InstrumentationGuide />
        </Form>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/test/',
              query: {skipGuideDetection: 'true'},
            },
          },
        }
      );

      // Verify that the guide content is NOT shown
      expect(screen.queryByText(/Auto-Instrument with/)).not.toBeInTheDocument();

      // Should still show the dropdown with default state
      expect(screen.getByRole('button', {name: 'Select Platform'})).toBeInTheDocument();
    });

    it('does not override existing query params when project is set', async () => {
      const pythonProject = ProjectFixture({id: '5', platform: 'python'});
      const phpProject = ProjectFixture({id: '6', platform: 'php'});
      ProjectsStore.loadInitialData([pythonProject, phpProject]);

      // Start with PHP guide already selected in query params
      const {router} = render(
        <Form initialData={{projectId: pythonProject.id}}>
          <InstrumentationGuide />
        </Form>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/test/',
              query: {platform: 'php', guide: 'upsert'},
            },
          },
        }
      );

      // Verify router has correct query params
      expect(router.location.query.platform).toBe('php');
      expect(router.location.query.guide).toBe('upsert');

      // Should show PHP guide, not auto-select Python based on project
      await waitFor(() => {
        expect(screen.getByText('Auto-Instrument with PHP')).toBeInTheDocument();
      });
    });

    it('auto-selects platform based on selected project', async () => {
      const pythonProject = ProjectFixture({id: '99', platform: 'python'});
      ProjectsStore.loadInitialData([pythonProject]);

      render(
        <Form initialData={{projectId: pythonProject.id}}>
          <InstrumentationGuide />
        </Form>
      );

      // Should auto-select Python platform and show the guide
      expect(await screen.findByText('Auto-Instrument with Python')).toBeInTheDocument();
    });

    it('falls back to base platform when project platform has no exact match', async () => {
      const nodeExpressProject = ProjectFixture({id: '98', platform: 'node-express'});
      ProjectsStore.loadInitialData([nodeExpressProject]);

      render(
        <Form initialData={{projectId: nodeExpressProject.id}}>
          <InstrumentationGuide />
        </Form>
      );

      // Should fall back to 'node' since 'node-express' has no guide
      expect(await screen.findByText('Auto-Instrument with NodeJS')).toBeInTheDocument();
    });

    it('updates guide when project is changed via form field', async () => {
      const pythonProject = ProjectFixture({
        id: '3',
        slug: 'python-proj',
        platform: 'python',
      });
      const nodeProject = ProjectFixture({id: '4', slug: 'node-proj', platform: 'node'});
      ProjectsStore.loadInitialData([pythonProject, nodeProject]);

      // Start with PHP guide in query params and python project selected
      render(
        <Form initialData={{projectId: pythonProject.id}}>
          <SentryProjectSelectorField
            name="projectId"
            label="Project"
            projects={[pythonProject, nodeProject]}
          />
          <InstrumentationGuide />
        </Form>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/test/',
              query: {platform: 'php', guide: 'upsert'},
            },
          },
        }
      );

      // Should initially show PHP guide (from query params)
      expect(await screen.findByText('Auto-Instrument with PHP')).toBeInTheDocument();

      // Change to node project
      const projectSelector = screen.getByRole('textbox', {name: 'Project'});
      await selectEvent.select(projectSelector, 'node-proj');

      // Should now show NodeJS guide
      expect(await screen.findByText('Auto-Instrument with NodeJS')).toBeInTheDocument();
    });
  });
});
