import {EventFixture} from 'sentry-fixture/event';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {EventTags} from 'sentry/components/events/eventTags';

describe('EventTagsTree', function () {
  const {organization, project} = initializeOrg();
  const tags = [
    {key: 'app', value: 'Sentry'},
    {key: 'app.app_start_time', value: '2008-05-08T00:00:00.000Z'},
    {key: 'app.app_name', value: 'com.sentry.app'},
    {key: 'app.version', value: '0.0.2'},
    {key: 'tree', value: 'maple'},
    {key: 'tree.branch', value: 'jagged'},
    {key: 'tree.branch.leaf', value: 'red'},
    {key: 'favorite.color', value: 'teal'},
    {key: 'favorite.animal', value: 'dog'},
    {key: 'favorite.game', value: 'everdell'},
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
    'favorite.color',
    'favorite.animal',
    'favorite.game',
    'magic.is',
    'magic.is.probably.not',
  ];
  const emptyBranchTags = ['favorite', 'magic', 'probably'];
  const treeBranchTags = [
    'app_start_time',
    'app_name',
    'version',
    'tree',
    'branch',
    'leaf',
    'color',
    'animal',
    'game',
    'is',
    'not',
    'double..dot',
    'im.a.bit.too.nested.to.display',
  ].concat(emptyBranchTags);

  const event = EventFixture({tags});
  const referrer = 'event-tags-table';
  let mockDetailedProject: jest.Mock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    mockDetailedProject = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
  });

  it('renders tag tree', async function () {
    render(<EventTags projectSlug={project.slug} event={event} />, {
      organization,
    });
    expect(mockDetailedProject).toHaveBeenCalled();
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

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
        await screen.findByLabelText('Search issues with this tag value')
      ).toBeInTheDocument();
      expect(
        await screen.findByLabelText('View other events with this tag value')
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Copy tag value to clipboard')).toBeInTheDocument();
    }
  });

  it('renders release tag differently', async function () {
    const releaseVersion = 'v1.0';

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
      organization,
    });
    expect(mockDetailedProject).toHaveBeenCalled();
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

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
      validateLink: () => {
        const linkElement = screen.getByRole('link', {name: 'abc123'});
        const href = linkElement.attributes.getNamedItem('href');
        expect(href?.value).toContain(
          `/organizations/${organization.slug}/performance/summary/`
        );
        expect(href?.value).toContain(`project=${project.id}`);
        expect(href?.value).toContain('transaction=abc123');
        expect(href?.value).toContain(`referrer=${referrer}`);
      },
    },
    {
      tag: {key: 'replay_id', value: 'def456'},
      labelText: 'View this replay',
      validateLink: () => {
        const linkElement = screen.getByRole('link', {name: 'def456'});
        expect(linkElement).toHaveAttribute(
          'href',
          `/organizations/${organization.slug}/replays/def456/?referrer=${referrer}`
        );
      },
    },
    {
      tag: {key: 'external-link', value: 'https://example.com'},
      labelText: 'Visit this external link',
      validateLink: async () => {
        renderGlobalModal();
        const linkElement = screen.getByText('https://example.com');
        await userEvent.click(linkElement);
        expect(await screen.findByTestId('external-link-warning')).toBeInTheDocument();
      },
    },
  ])(
    "renders unique links for '$tag.key' tag",
    async ({tag, labelText, validateLink}) => {
      const uniqueTagsEvent = EventFixture({tags: [tag], projectID: project.id});
      render(<EventTags projectSlug={project.slug} event={uniqueTagsEvent} />, {
        organization,
      });
      expect(mockDetailedProject).toHaveBeenCalled();
      expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

      const dropdown = screen.getByLabelText('Tag Actions Menu');
      await userEvent.click(dropdown);
      expect(screen.getByLabelText(labelText)).toBeInTheDocument();
      validateLink();
    }
  );

  it('renders error message tooltips instead of dropdowns', async function () {
    const errorTagEvent = EventFixture({
      _meta: {
        tags: {
          0: {
            value: {
              '': {
                err: ['value_too_long'],
              },
            },
          },
          2: {
            value: {
              '': {
                err: [
                  [
                    'invalid_data',
                    {
                      reason: "invalid character '\\n'",
                    },
                  ],
                ],
                val: 'invalid\ncharacters\n🇨🇦🔥🤡',
              },
            },
          },
        },
      },
      tags: [
        {key: 'some-super-long-tag', value: null},
        {key: 'some-acceptable-tag', value: 'im acceptable'},
        {key: 'some-invalid-char-tag', value: null},
      ],
    });
    render(<EventTags projectSlug={project.slug} event={errorTagEvent} />, {
      organization,
    });
    expect(mockDetailedProject).toHaveBeenCalled();
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    // Should only be one dropdown, others have errors
    const dropdown = screen.getByLabelText('Tag Actions Menu');
    expect(dropdown).toBeInTheDocument();

    const errorRows = screen.queryAllByTestId('tag-tree-row-errors');
    expect(errorRows).toHaveLength(2);
  });

  it('avoids rendering nullish tags', async function () {
    const uniqueTagsEvent = EventFixture({
      tags: [
        {key: null, value: 'null tag'},
        {key: undefined, value: 'undefined tag'},
        {key: 'boring-tag', value: 'boring tag'},
      ],
    });
    render(<EventTags projectSlug={project.slug} event={uniqueTagsEvent} />, {
      organization,
    });
    expect(mockDetailedProject).toHaveBeenCalled();
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    expect(screen.getByText('boring-tag', {selector: 'div'})).toBeInTheDocument();
    expect(screen.getByText('boring tag')).toBeInTheDocument();
    expect(screen.queryByText('null tag')).not.toBeInTheDocument();
    expect(screen.queryByText('undefined tag')).not.toBeInTheDocument();
  });

  it("renders 'Add to event highlights' option based on highlights", async function () {
    const highlightsEvent = EventFixture({
      tags: [
        {key: 'useless-tag', value: 'not so much'},
        {key: 'highlighted-tag', value: 'so important'},
      ],
    });
    const highlightProject = {...project, highlightTags: ['highlighted-tag']};
    MockApiClient.clearMockResponses();
    const mockHighlightProject = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: highlightProject,
    });
    render(<EventTags projectSlug={highlightProject.slug} event={highlightsEvent} />, {
      organization,
    });
    expect(mockHighlightProject).toHaveBeenCalled();
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    const normalTagRow = screen
      .getByText('useless-tag', {selector: 'div'})
      .closest('div[data-test-id=tag-tree-row]') as HTMLElement;
    const normalTagDropdown = within(normalTagRow).getByLabelText('Tag Actions Menu');
    await userEvent.click(normalTagDropdown);
    expect(screen.getByLabelText('Add to event highlights')).toBeInTheDocument();

    const highlightTagRow = screen
      .getByText('highlighted-tag', {selector: 'div'})
      .closest('div[data-test-id=tag-tree-row]') as HTMLElement;
    const highlightTagDropdown =
      within(highlightTagRow).getByLabelText('Tag Actions Menu');
    await userEvent.click(highlightTagDropdown);
    expect(screen.queryByLabelText('Add to event highlights')).not.toBeInTheDocument();
  });

  it("renders 'Add to event highlights' option based on permissions", async function () {
    const readAccessOrganization = OrganizationFixture({
      access: ['org:read'],
    });
    const highlightsEvent = EventFixture({
      tags: [{key: 'useless-tag', value: 'not so much'}],
    });
    const highlightProject = {
      ...project,
      access: ['project:read'],
      highlightTags: ['highlighted-tag'],
    };
    MockApiClient.clearMockResponses();
    const mockHighlightProject = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: highlightProject,
    });
    render(<EventTags projectSlug={highlightProject.slug} event={highlightsEvent} />, {
      organization: readAccessOrganization,
    });
    expect(mockHighlightProject).toHaveBeenCalled();
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    const normalTagRow = screen
      .getByText('useless-tag', {selector: 'div'})
      .closest('div[data-test-id=tag-tree-row]') as HTMLElement;
    const normalTagDropdown = within(normalTagRow).getByLabelText('Tag Actions Menu');
    await userEvent.click(normalTagDropdown);
    expect(screen.queryByLabelText('Add to event highlights')).not.toBeInTheDocument();
  });

  it('renders tag details link when on issue details route', async function () {
    const highlightsEvent = EventFixture({
      tags: [{key: 'useless-tag', value: 'not so much'}],
    });
    const issueDetailsRouter = RouterFixture({
      location: LocationFixture({
        pathname: `/organizations/${organization.slug}/issues/${event.groupID}/`,
      }),
    });

    render(<EventTags projectSlug={project.slug} event={highlightsEvent} />, {
      organization,
      router: issueDetailsRouter,
    });
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

    const normalTagRow = screen
      .getByText('useless-tag', {selector: 'div'})
      .closest('div[data-test-id=tag-tree-row]') as HTMLElement;
    const normalTagDropdown = within(normalTagRow).getByLabelText('Tag Actions Menu');
    await userEvent.click(normalTagDropdown);
    expect(await screen.findByLabelText('Tag breakdown')).toBeInTheDocument();
  });
});
