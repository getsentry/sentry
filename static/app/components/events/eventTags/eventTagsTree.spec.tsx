import {EventFixture} from 'sentry-fixture/event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EventTags} from 'sentry/components/events/eventTags';

describe('EventTagsTree', function () {
  const {organization, project, router} = initializeOrg();
  const defaultTags = [
    {key: 'tree', value: 'maple'},
    {key: 'tree.branch', value: 'jagged'},
    {key: 'tree.branch.leaf', value: 'red'},
    {key: 'favourite.colour', value: 'teal'},
    {key: 'favourite.animal', value: 'dog'},
    {key: 'favourite.game', value: 'everdell'},
    {key: 'magic.is', value: 'real'},
    {key: 'magic.is.probably.not', value: 'spells'},
    {key: 'double..dot', value: 'works'},
  ];
  const pillOnlyTags = [
    'tree.branch',
    'tree.branch.leaf',
    'favourite.colour',
    'favourite.animal',
    'favourite.game',
    'magic.is',
    'magic.is.probably.not',
  ];
  const treeTrunks = [
    'tree',
    'branch',
    'leaf',
    'favourite',
    'colour',
    'animal',
    'game',
    'magic',
    'is',
    'probably',
    'not',
    'double',
    'dot',
  ];
  const event = EventFixture({tags: defaultTags});

  it('avoids tag tree without query param', function () {
    render(
      <EventTags
        organization={organization}
        projectSlug={project.slug}
        location={router.location}
        event={event}
      />,
      {organization}
    );
    defaultTags.forEach(({key: fullTagKey, value}) => {
      expect(screen.getByText(fullTagKey)).toBeInTheDocument();
      expect(screen.getByText(value)).toBeInTheDocument();
    });
  });

  it('renders tag tree with query param', function () {
    render(
      <EventTags
        organization={organization}
        projectSlug={project.slug}
        location={{...router.location, query: {tagsTree: '1'}}}
        event={event}
      />,
      {organization}
    );

    defaultTags.forEach(({value}) => {
      expect(screen.getByText(value)).toBeInTheDocument();
    });

    pillOnlyTags.forEach(tag => {
      expect(screen.queryByText(tag)).not.toBeInTheDocument();
    });

    treeTrunks.forEach(tag => {
      expect(screen.getByText(tag)).toBeInTheDocument();
    });
  });
});
