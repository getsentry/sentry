import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EventTags} from 'sentry/components/events/eventTags';

describe('EventTagsTree', function () {
  const {organization, project, router} = initializeOrg();
  const tags = [
    {key: 'app', value: 'Sentry'},
    {key: 'app.app_start_time', value: '2008-05-08T00:00:00.000Z'},
    {key: 'app.app_name', value: 'com.sentry.app'},
    {key: 'app.version', value: '0.0.2'},
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
    'app.app_start_time',
    'app.app_name',
    'app.version',
    'tree.branch',
    'tree.branch.leaf',
    'favourite.colour',
    'favourite.animal',
    'favourite.game',
    'magic.is',
    'magic.is.probably.not',
  ];
  const emptyBranchTags = ['favourite', 'magic', 'probably'];
  const treeBranchTags = [
    'app_start_time',
    'app_name',
    'version',
    'tree',
    'branch',
    'leaf',
    'colour',
    'animal',
    'game',
    'is',
    'not',
    'double..dot',
    'im.a.bit.too.nested.to.display',
  ].concat(emptyBranchTags);

  const event = EventFixture({tags});

  it('avoids tag tree without query param or flag', function () {
    render(<EventTags projectSlug={project.slug} event={event} />, {organization});
    tags.forEach(({key: fullTagKey, value}) => {
      expect(screen.getByText(fullTagKey)).toBeInTheDocument();
      expect(screen.getByText(value)).toBeInTheDocument();
    });
  });

  /** Asserts that new tags view is rendering the appropriate data. Requires render() call prior. */
  async function assertNewTagsView() {
    tags.forEach(({value}) => {
      expect(screen.getByText(value)).toBeInTheDocument();
    });

    pillOnlyTags.forEach(tag => {
      const tagComponent = screen.queryByText(tag);
      expect(tagComponent).toBeInTheDocument();
      expect(tagComponent).toHaveAttribute('aria-hidden', 'true');
    });

    treeBranchTags.forEach(tag => {
      expect(screen.getByText(tag, {selector: 'div'})).toBeInTheDocument();
    });

    const rows = screen.queryAllByTestId('tag-tree-row');

    const expectedRowCount = tags.length + emptyBranchTags.length;
    expect(rows).toHaveLength(expectedRowCount);

    const columns = screen.queryAllByTestId('tag-tree-column');
    expect(columns.length).toBeLessThanOrEqual(2);

    const linkDropdowns = screen.queryAllByLabelText('Tag Actions Menu');
    expect(linkDropdowns).toHaveLength(tags.length);

    for (const link of linkDropdowns) {
      await userEvent.click(link);
      expect(
        screen.getByLabelText('View issues with this tag value')
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('View other events with this tag value')
      ).toBeInTheDocument();
    }
  }

  it('renders tag tree with query param', async function () {
    router.location.query.tagsTree = '1';
    render(<EventTags projectSlug={project.slug} event={event} />, {
      organization,
      router,
    });
    await assertNewTagsView();
  });

  it("renders tag tree with the 'event-tags-tree-ui' feature", async function () {
    const featuredOrganization = OrganizationFixture({features: ['event-tags-tree-ui']});
    render(<EventTags projectSlug={project.slug} event={event} />, {
      organization: featuredOrganization,
    });
    await assertNewTagsView();
  });

  it('renders release tag differently', async function () {
    const releaseVersion = 'v1.0';
    const featuredOrganization = OrganizationFixture({features: ['event-tags-tree-ui']});

    const reposRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [],
    });
    const releasesRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${releaseVersion}/`,
      body: [],
    });
    const deploysRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/${releaseVersion}/deploys/`,
      body: [],
    });

    const releaseEvent = EventFixture({
      tags: [{key: 'release', value: releaseVersion}],
    });
    render(<EventTags projectSlug={project.slug} event={releaseEvent} />, {
      organization: featuredOrganization,
    });
    const versionText = screen.getByText<
      HTMLElement & {parentElement: HTMLAnchorElement}
    >(releaseVersion);
    const anchorLink = versionText.parentElement;
    expect(anchorLink.href).toContain(
      `/organizations/${organization.slug}/releases/${releaseVersion}/`
    );
    expect(reposRequest).toHaveBeenCalled();
    expect(releasesRequest).toHaveBeenCalled();
    expect(deploysRequest).toHaveBeenCalled();
    const dropdown = screen.getByLabelText('Tag Actions Menu');
    await userEvent.click(dropdown);
    expect(screen.getByLabelText('View this release')).toBeInTheDocument();
  });

  it.each([
    {
      tag: {key: 'transaction', value: 'abc123'},
      labelText: 'View this transaction',
    },
    {
      tag: {key: 'replay_id', value: 'def456'},
      labelText: 'View this replay',
    },
    {
      tag: {key: 'replayId', value: 'ghi789'},
      labelText: 'View this replay',
    },
    {
      tag: {key: 'external-link', value: 'https://example.com'},
      labelText: 'Visit this external link',
    },
  ])("renders unique links for '$tag.key' tag", async ({tag, labelText}) => {
    const featuredOrganization = OrganizationFixture({features: ['event-tags-tree-ui']});
    const uniqueTagsEvent = EventFixture({tags: [tag]});
    render(<EventTags projectSlug={project.slug} event={uniqueTagsEvent} />, {
      organization: featuredOrganization,
    });
    const dropdown = screen.getByLabelText('Tag Actions Menu');
    await userEvent.click(dropdown);
    expect(screen.getByLabelText(labelText)).toBeInTheDocument();
  });
});
