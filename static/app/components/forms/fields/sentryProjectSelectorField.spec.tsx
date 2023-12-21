import selectEvent from 'react-select-event';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
});
