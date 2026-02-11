import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import SentryProjectSelectorField from './sentryProjectSelectorField';

describe('SentryProjectSelectorField', () => {
  it('can change values', async () => {
    const mock = jest.fn();
    const projects = [
      ProjectFixture(),
      ProjectFixture({
        id: '23',
        slug: 'my-proj',
        name: 'My Proj',
      }),
    ];
    render(
      <SentryProjectSelectorField onChange={mock} name="project" projects={projects} />
    );

    await selectEvent.select(screen.getByText(/choose sentry project/i), 'my-proj');

    expect(mock).toHaveBeenCalledWith('23', expect.anything());
  });

  it('can group values', async () => {
    const mock = jest.fn();
    const projects = [
      ProjectFixture(),
      ProjectFixture({
        id: '23',
        slug: 'my-proj',
        name: 'My Proj',
      }),
      ProjectFixture({
        id: '24',
        slug: 'other-project',
        name: 'My Other Project',
      }),
    ];
    render(
      <SentryProjectSelectorField
        groupProjects={project => (project.slug === 'other-project' ? 'other' : 'main')}
        groups={[
          {key: 'main', label: 'Main projects'},
          {key: 'other', label: 'Other'},
        ]}
        onChange={mock}
        name="project"
        projects={projects}
      />
    );

    await selectEvent.openMenu(screen.getByText(/choose sentry project/i));

    expect(screen.getByText('Main projects')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  it('can select multiple values', async () => {
    const mock = jest.fn();
    const projects = [
      ProjectFixture({id: '1', slug: 'project-a'}),
      ProjectFixture({id: '2', slug: 'project-b'}),
      ProjectFixture({id: '3', slug: 'project-c'}),
    ];
    render(
      <SentryProjectSelectorField
        onChange={mock}
        name="projects"
        projects={projects}
        multiple
      />
    );

    const input = screen.getByRole('textbox');

    await selectEvent.select(input, 'project-a');
    expect(mock).toHaveBeenLastCalledWith(['1'], expect.anything());

    await selectEvent.select(input, 'project-b');
    expect(mock).toHaveBeenLastCalledWith(['1', '2'], expect.anything());
  });
});
