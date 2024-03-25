import {parseIssuePrioritySearch} from 'sentry/views/issueList/utils/parseIssuePrioritySearch';

describe('parseIssuePrioritySearch', function () {
  it('can parse array values', function () {
    const priorityValues = parseIssuePrioritySearch(
      'is:unresolved issue.priority:[high,medium]'
    );

    expect(priorityValues).toEqual(new Set(['high', 'medium']));
  });

  it('can parse single values', function () {
    const priorityValues = parseIssuePrioritySearch(
      'is:unresolved issue.priority:medium'
    );

    expect(priorityValues).toEqual(new Set(['medium']));
  });

  it('can parse negated array values', function () {
    const priorityValues = parseIssuePrioritySearch(
      'is:unresolved !issue.priority:[low, medium]'
    );

    expect(priorityValues).toEqual(new Set(['high']));
  });

  it('can parse negated single values', function () {
    const priorityValues = parseIssuePrioritySearch(
      'is:unresolved !issue.priority:medium'
    );

    expect(priorityValues).toEqual(new Set(['high', 'low']));
  });

  it('can parse query without priority', function () {
    const priorityValues = parseIssuePrioritySearch('is:unresolved');

    expect(priorityValues).toEqual(new Set(['high', 'medium', 'low']));
  });
});
