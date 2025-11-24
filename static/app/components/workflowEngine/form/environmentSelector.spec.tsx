import {useState} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {EnvironmentSelector} from 'sentry/components/workflowEngine/form/environmentSelector';
import ProjectsStore from 'sentry/stores/projectsStore';

describe('EnvironmentSelector', () => {
  it('renders & handles selection', async () => {
    const {projects} = initializeOrg({
      projects: [
        {id: '1', slug: 'project-1', environments: ['prod', 'staging'], isMember: true},
        {id: '2', slug: 'project-2', environments: ['prod', 'stage'], isMember: false},
      ],
    });
    ProjectsStore.loadInitialData(projects);

    const mockOnChange = jest.fn();

    function Component() {
      const [environment, setEnvironment] = useState('');

      return (
        <EnvironmentSelector
          value={environment}
          onChange={value => {
            setEnvironment(value);
            mockOnChange(value);
          }}
        />
      );
    }

    render(<Component />);

    // Open list
    await userEvent.click(screen.getByRole('button', {name: 'All Environments'}));

    // Get groups
    const allEnvironments = screen.getByRole('group', {
      name: 'All Environments',
    });
    const userProjectEnvironments = screen.getByRole('group', {
      name: 'Environments in My Projects',
    });
    const otherProjectEnvironments = screen.getByRole('group', {
      name: 'Other Environments',
    });

    // Environments are correctly grouped
    expect(
      within(allEnvironments).getByRole('option', {name: 'All Environments'})
    ).toBeInTheDocument();
    expect(
      within(userProjectEnvironments).getByRole('option', {name: 'prod'})
    ).toBeInTheDocument();
    expect(
      within(userProjectEnvironments).getByRole('option', {name: 'staging'})
    ).toBeInTheDocument();
    expect(
      within(otherProjectEnvironments).getByRole('option', {name: 'stage'})
    ).toBeInTheDocument();
    // "prod" should not be shown twice
    expect(
      within(otherProjectEnvironments).queryByRole('option', {name: 'prod'})
    ).not.toBeInTheDocument();

    // Select "prod"
    await userEvent.click(screen.getByRole('option', {name: 'prod'}));

    // Trigger label is updated
    expect(screen.getByRole('button', {name: 'prod'})).toBeInTheDocument();
    expect(mockOnChange).toHaveBeenCalledWith('prod');
  });
});
