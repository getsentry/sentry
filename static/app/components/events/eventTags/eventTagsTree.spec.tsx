import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EventTags} from 'sentry/components/events/eventTags';

describe('EventTagsTree', function () {
  const {organization, project} = initializeOrg();
  const tags = [
    {key: 'tree', value: 'maple'},
    {key: 'tree.branch', value: 'jagged'},
    {key: 'tree.branch.leaf', value: 'red'},
    {key: 'favourite.colour', value: 'teal'},
    {key: 'favourite.animal', value: 'dog'},
    {key: 'favourite.game', value: 'everdell'},
    {key: 'magic.is', value: 'real'},
    {key: 'magic.is.probably.not', value: 'spells'},
    {key: 'double..dot', value: 'works'},
    {key: 'im.a.bit.too.nested.to.display', value: 'bird'},
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
  const treeBranchTags = [
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
    'double..dot',
    'im.a.bit.too.nested.to.display',
  ];
  const event = EventFixture({tags});

  it('avoids tag tree without query param', function () {
    render(<EventTags projectSlug={project.slug} event={event} />, {organization});
    tags.forEach(({key: fullTagKey, value}) => {
      expect(screen.getByText(fullTagKey)).toBeInTheDocument();
      expect(screen.getByText(value)).toBeInTheDocument();
    });
  });

  it('renders tag tree with query param', function () {
    render(<EventTags projectSlug={project.slug} event={event} />, {organization});

    tags.forEach(({value}) => {
      expect(screen.getByText(value)).toBeInTheDocument();
    });

    pillOnlyTags.forEach(tag => {
      expect(screen.queryByText(tag)).not.toBeInTheDocument();
    });

    treeBranchTags.forEach(tag => {
      expect(screen.getByText(tag)).toBeInTheDocument();
    });
  });

  it("renders tag tree with the 'event-tags-tree-ui' feature", function () {
    const featuredOrganization = OrganizationFixture({features: ['event-tags-tree-ui']});
    render(<EventTags projectSlug={project.slug} event={event} />, {
      organization: featuredOrganization,
    });

    tags.forEach(({value}) => {
      expect(screen.getByText(value)).toBeInTheDocument();
    });

    pillOnlyTags.forEach(tag => {
      expect(screen.queryByText(tag)).not.toBeInTheDocument();
    });

    treeBranchTags.forEach(tag => {
      expect(screen.getByText(tag)).toBeInTheDocument();
    });
  });
});
