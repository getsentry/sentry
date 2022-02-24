import {generateIssueWidgetFieldOptions} from 'sentry/views/dashboardsV2/widgetBuilder/issueWidget/utils';

describe('generateIssueWidgetFieldOptions', function () {
  it('returns default issue fields', () => {
    const issueFields = generateIssueWidgetFieldOptions();
    expect(Object.keys(issueFields)).toEqual([
      'field:assignee',
      'field:events',
      'field:firstSeen',
      'field:isBookmarked',
      'field:isHandled',
      'field:isSubscribed',
      'field:issue',
      'field:lastSeen',
      'field:level',
      'field:lifetimeEvents',
      'field:lifetimeUsers',
      'field:links',
      'field:platform',
      'field:project',
      'field:status',
      'field:title',
      'field:users',
    ]);
  });
  it('returns supplied issue fields', () => {
    const issueFields = generateIssueWidgetFieldOptions({
      assignee: 'string',
      title: 'string',
    });
    expect(Object.keys(issueFields)).toEqual(['field:assignee', 'field:title']);
  });
});
