import {OrganizationFixture} from 'sentry-fixture/organization';

import {DisplayType} from 'sentry/views/dashboards/types';
import {generateIssueWidgetFieldOptions} from 'sentry/views/dashboards/widgetBuilder/issueWidget/utils';

describe('generateIssueWidgetFieldOptions', () => {
  it('returns default issue fields', () => {
    const issueFields = generateIssueWidgetFieldOptions(OrganizationFixture());
    expect(Object.keys(issueFields)).toEqual([
      'field:assignee',
      'field:events',
      'field:firstSeen',
      'field:isBookmarked',
      'field:isHandled',
      'field:isSubscribed',
      'field:issue',
      'field:lastSeen',
      'field:lastSeenAgo',
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
  it('returns default issue fields for series display type', () => {
    const issueFields = generateIssueWidgetFieldOptions(
      OrganizationFixture(),
      DisplayType.BAR
    );
    expect(Object.keys(issueFields)).toEqual([
      'field:new_issues',
      'field:resolved_issues',
      'function:count',
    ]);
  });
});
