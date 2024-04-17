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
});
