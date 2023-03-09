import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import type {Actor, ParsedOwnershipRule} from 'sentry/types';

import {OwnershipRulesTable} from './ownshipRulesTable';

describe('OwnershipRulesTable', () => {
  const user1 = TestStubs.User();
  const user2 = TestStubs.User({id: '2', name: 'Jane Doe'});

  beforeEach(() => {
    MemberListStore.init();
    MemberListStore.loadInitialData([user1, user2]);
  });

  it('should render empty state', () => {
    render(<OwnershipRulesTable projectRules={[]} codeowners={[]} />);
    expect(screen.getByText('No ownership rules found')).toBeInTheDocument();
  });

  it('should render project owners members', () => {
    const rules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: 'pattern', type: 'path'},
        owners: [{type: 'user', id: user1.id, name: user1.name}],
      },
    ];

    render(<OwnershipRulesTable projectRules={rules} codeowners={[]} />);

    expect(screen.getByText('Path')).toBeInTheDocument();
    expect(screen.getByText('pattern')).toBeInTheDocument();
    expect(screen.getByText(user1.name)).toBeInTheDocument();
  });

  it('should render multiple project owners', () => {
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

    expect(screen.getByText('Path')).toBeInTheDocument();
    expect(screen.getByText('pattern')).toBeInTheDocument();
    expect(screen.getByText(`${user1.name} and 1 other`)).toBeInTheDocument();
    expect(screen.queryByText(user2.name)).not.toBeInTheDocument();
  });

  it('should filter by rule type and pattern', () => {
    const owners: Actor[] = [{type: 'user', id: user1.id, name: user1.name}];
    const rules: ParsedOwnershipRule[] = [
      {matcher: {pattern: 'filepath', type: 'path'}, owners},
      {matcher: {pattern: 'mytag', type: 'tag'}, owners},
    ];

    render(<OwnershipRulesTable projectRules={rules} codeowners={[]} />);

    const searchbar = screen.getByPlaceholderText('Search by type or rule');
    userEvent.paste(searchbar, 'path');

    expect(screen.getByText('filepath')).toBeInTheDocument();
    expect(screen.queryByText('mytag')).not.toBeInTheDocument();

    userEvent.clear(searchbar);
    userEvent.paste(searchbar, 'mytag');

    expect(screen.getByText('mytag')).toBeInTheDocument();
    expect(screen.queryByText('filepath')).not.toBeInTheDocument();
  });

  it('should paginate results', () => {
    const owners: Actor[] = [{type: 'user', id: user1.id, name: user1.name}];
    const rules: ParsedOwnershipRule[] = Array(100)
      .fill(0)
      .map((_, i) => ({
        matcher: {pattern: `mytag${i}`, type: 'tag'},
        owners,
      }));

    render(<OwnershipRulesTable projectRules={rules} codeowners={[]} />);

    expect(screen.getByText('mytag1')).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', {name: 'Next page'}));
    expect(screen.getByText('mytag30')).toBeInTheDocument();
    expect(screen.queryByText('mytag1')).not.toBeInTheDocument();
  });
});
