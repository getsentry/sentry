import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';

describe('platform event context', function () {
  const platformContexts = {
    laravel: {
      type: 'default',
      some: 'value',
      number: 123,
    },
  };
  const organization = OrganizationFixture();
  const event = EventFixture({contexts: platformContexts});
  const group = GroupFixture();
  const project = ProjectFixture();

  it('renders laravel context', function () {
    const alias = 'laravel';
    render(
      <ContextCard
        type={platformContexts[alias].type}
        alias={alias}
        value={platformContexts[alias]}
        event={event}
        group={group}
        project={project}
      />,
      {organization}
    );

    expect(screen.getByText('Laravel Context')).toBeInTheDocument();
    expect(screen.getByTestId(`${alias}-context-icon`)).toBeInTheDocument();
  });
});
