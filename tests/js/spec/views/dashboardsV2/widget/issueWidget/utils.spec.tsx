import {generateIssueWidgetFieldOptions} from 'sentry/views/dashboardsV2/widget/issueWidget/utils';

describe('generateIssueWidgetFieldOptions', function () {
  it('returns default issue fields', () => {
    const issueFields = generateIssueWidgetFieldOptions();
    expect(Object.keys(issueFields)).toEqual([
      'field:assignee',
      'field:culprit',
      'field:isBookmarked',
      'field:isHandled',
      'field:isSubscribed',
      'field:issue',
      'field:level',
      'field:permalink',
      'field:platform',
      'field:status',
      'field:title',
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
