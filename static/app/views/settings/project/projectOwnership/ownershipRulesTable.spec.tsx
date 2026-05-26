import {CodeOwnerFixture} from 'sentry-fixture/codeOwner';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import type {Actor} from 'sentry/types/core';
import type {ParsedOwnershipRule} from 'sentry/types/group';

import {OwnershipRulesTable} from './ownershipRulesTable';

describe('OwnershipRulesTable', () => {
  const user1 = UserFixture();
  const user2 = UserFixture({id: '2', name: 'Jane Doe'});

  beforeEach(() => {
    ConfigStore.init();
    ConfigStore.set('user', user1);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [user1, user2].map(user => ({user})),
    });
  });

  it('should render empty state', async () => {
    render(<OwnershipRulesTable projectRules={[]} codeowners={[]} />);
    expect(await screen.findByText('No ownership rules found')).toBeInTheDocument();
  });

  it('should render project owners members', async () => {
    const rules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: 'pattern', type: 'path'},
        owners: [{type: 'user', id: user1.id, name: user1.name}],
      },
    ];

    render(<OwnershipRulesTable projectRules={rules} codeowners={[]} />);

    expect(await screen.findByText('path')).toBeInTheDocument();
    expect(screen.getByText('pattern')).toBeInTheDocument();
    expect(screen.getByText(user1.name)).toBeInTheDocument();
  });

  it('should filter codeowners rules without actor names', async () => {
    const rules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: 'pattern', type: 'path'},
        // Name = undefined only seems to happen when adding a new codeowners file
        owners: [{type: 'user', id: user1.id, name: undefined as any}],
      },
      {
        matcher: {pattern: 'my/path', type: 'path'},
        owners: [{type: 'user', id: user2.id, name: user2.name}],
      },
    ];

    render(
      <OwnershipRulesTable
        projectRules={[]}
        codeowners={[CodeOwnerFixture({schema: {rules, version: 1}})]}
      />
    );

    expect(await screen.findByText('pattern')).toBeInTheDocument();
    expect(screen.getByText('my/path')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Everyone'})).toBeEnabled();
  });

  it('should render multiple project owners', async () => {
    const rules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: 'pattern', type: 'path'},
        owners: [
          {type: 'user', id: user1.id, name: user1.name},
          {type: 'user', id: user2.id, name: user2.name},
        ],
      },
    ];

    render(<OwnershipRulesTable projectRules={rules} codeowners={[]} />);

    expect(await screen.findByText('path')).toBeInTheDocument();
    expect(screen.getByText('pattern')).toBeInTheDocument();
    expect(screen.getByText(`${user1.name} and 1 other`)).toBeInTheDocument();
    expect(screen.queryByText(user2.name)).not.toBeInTheDocument();
  });

  it('should filter by rule type and pattern', async () => {
    const owners: Actor[] = [{type: 'user', id: user1.id, name: user1.name}];
    const rules: ParsedOwnershipRule[] = [
      {matcher: {pattern: 'filepath', type: 'path'}, owners},
      {matcher: {pattern: 'mytag', type: 'tag'}, owners},
    ];

    render(<OwnershipRulesTable projectRules={rules} codeowners={[]} />);

    const searchbar = screen.getByPlaceholderText('Search by type or rule');
    await userEvent.click(searchbar);
    await userEvent.paste('path');

    expect(screen.getByText('filepath')).toBeInTheDocument();
    expect(screen.queryByText('mytag')).not.toBeInTheDocument();

    // Change the filter to mytag
    await userEvent.clear(searchbar);
    await userEvent.paste('mytag');

    expect(screen.getByText('mytag')).toBeInTheDocument();
    expect(screen.queryByText('filepath')).not.toBeInTheDocument();
  });

  it('should filter by my teams by default', async () => {
    const rules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: 'filepath', type: 'path'},
        owners: [{type: 'user', id: user1.id, name: user1.name}],
      },
      {
        matcher: {pattern: 'mytag', type: 'tag'},
        owners: [{type: 'user', id: user2.id, name: user2.name}],
      },
    ];

    render(<OwnershipRulesTable projectRules={rules} codeowners={[]} />);

    expect(screen.getByText('filepath')).toBeInTheDocument();
    expect(screen.queryByText('mytag')).not.toBeInTheDocument();

    // Clear the filter
    await userEvent.click(screen.getByRole('button', {name: 'My Teams'}));
    await userEvent.click(screen.getByRole('button', {name: 'Clear'}));

    expect(screen.getByText('filepath')).toBeInTheDocument();
    expect(screen.getByText('mytag')).toBeInTheDocument();
  });

  it('preserves selected teams when rules are updated', async () => {
    const rules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: 'filepath', type: 'path'},
        owners: [{type: 'user', id: user1.id, name: user1.name}],
      },
      {
        matcher: {pattern: 'anotherpath', type: 'path'},
        owners: [{type: 'user', id: user2.id, name: user2.name}],
      },
    ];

    const {rerender} = render(
      <OwnershipRulesTable projectRules={rules} codeowners={[]} />
    );

    // Clear the filter
    await userEvent.click(screen.getByRole('button', {name: 'My Teams'}));
    await userEvent.click(screen.getByRole('button', {name: 'Clear'}));
    expect(screen.getAllByText('path')).toHaveLength(2);

    const newRules: ParsedOwnershipRule[] = [
      ...rules,
      {
        matcher: {pattern: 'thirdpath', type: 'path'},
        owners: [{type: 'user', id: user2.id, name: user2.name}],
      },
    ];

    rerender(<OwnershipRulesTable projectRules={newRules} codeowners={[]} />);
    expect(screen.getAllByText('path')).toHaveLength(3);
    expect(screen.getByRole('button', {name: 'Everyone'})).toBeInTheDocument();
  });

  it('should render owners without an id', async () => {
    const rules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: 'src/app/*', type: 'path'},
        owners: [{type: 'user', name: 'unresolved-user@example.com'}],
      },
      {
        matcher: {pattern: 'src/utils/*', type: 'path'},
        owners: [
          {type: 'user', id: user1.id, name: user1.name},
          {type: 'team', name: 'backend'},
        ],
      },
    ];

    render(<OwnershipRulesTable projectRules={rules} codeowners={[]} />);

    // Clear the "My Teams" filter to see all rules
    await userEvent.click(screen.getByRole('button', {name: 'My Teams'}));
    await userEvent.click(screen.getByRole('button', {name: 'Clear'}));

    expect(screen.getByText('src/app/*')).toBeInTheDocument();
    expect(screen.getByText('unresolved-user@example.com')).toBeInTheDocument();
    expect(screen.getByText('src/utils/*')).toBeInTheDocument();
  });

  it('should paginate results', async () => {
    const owners: Actor[] = [{type: 'user', id: user1.id, name: user1.name}];
    const rules: ParsedOwnershipRule[] = Array.from({length: 100})
      .fill(0)
      .map((_, i) => ({
        matcher: {pattern: `mytag${i}`, type: 'tag'},
        owners,
      }));

    render(<OwnershipRulesTable projectRules={rules} codeowners={[]} />);

    expect(screen.getByText('mytag1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next page'}));
    expect(screen.getByText('mytag30')).toBeInTheDocument();
    expect(screen.queryByText('mytag1')).not.toBeInTheDocument();
  });

  it('should render codeowner exclusion rules with no owners', async () => {
    const codeownerRules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: '/apps/github', type: 'codeowners'},
        owners: [],
      },
      {
        matcher: {pattern: 'src/utils/*', type: 'codeowners'},
        owners: [{type: 'user', id: user1.id, name: user1.name}],
      },
    ];

    render(
      <OwnershipRulesTable
        projectRules={[]}
        codeowners={[CodeOwnerFixture({schema: {rules: codeownerRules, version: 1}})]}
      />
    );

    // Clear the "My Teams" filter to see all rules
    await userEvent.click(screen.getByRole('button', {name: 'My Teams'}));
    await userEvent.click(screen.getByRole('button', {name: 'Clear'}));

    expect(screen.getByText('/apps/github')).toBeInTheDocument();
    expect(screen.getByText('No Owner')).toBeInTheDocument();
    expect(screen.getByText('src/utils/*')).toBeInTheDocument();
    expect(screen.getAllByText(user1.name).length).toBeGreaterThanOrEqual(1);
  });

  it('should show exclusion rules even when My Teams filter is active', async () => {
    const codeownerRules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: '/apps/github', type: 'codeowners'},
        owners: [],
      },
    ];
    const projectRules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: 'src/app/*', type: 'path'},
        owners: [{type: 'user', id: user1.id, name: user1.name}],
      },
    ];

    render(
      <OwnershipRulesTable
        projectRules={projectRules}
        codeowners={[CodeOwnerFixture({schema: {rules: codeownerRules, version: 1}})]}
      />
    );

    // Both rules should be visible with My Teams active (default)
    expect(screen.getByText('/apps/github')).toBeInTheDocument();
    expect(screen.getByText('No Owner')).toBeInTheDocument();
    expect(await screen.findByText('src/app/*')).toBeInTheDocument();
    expect(screen.getAllByText(user1.name).length).toBeGreaterThanOrEqual(1);
  });

  it('should render multiple exclusion rules', async () => {
    const codeownerRules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: '/apps/github', type: 'codeowners'},
        owners: [],
      },
      {
        matcher: {pattern: '/vendor/*', type: 'codeowners'},
        owners: [],
      },
      {
        matcher: {pattern: '/build/*', type: 'codeowners'},
        owners: [],
      },
    ];

    render(
      <OwnershipRulesTable
        projectRules={[]}
        codeowners={[CodeOwnerFixture({schema: {rules: codeownerRules, version: 1}})]}
      />
    );

    expect(await screen.findByText('/apps/github')).toBeInTheDocument();
    expect(screen.getByText('/vendor/*')).toBeInTheDocument();
    expect(screen.getByText('/build/*')).toBeInTheDocument();
    expect(screen.getAllByText('No Owner')).toHaveLength(3);
  });
});
