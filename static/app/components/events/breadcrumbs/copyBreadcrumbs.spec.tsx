import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';

import {formatBreadcrumbsAsMarkdown, formatBreadcrumbsAsText} from './copyBreadcrumbs';
import type {EnhancedCrumb} from './utils';

function createMockCrumb(
  overrides: Partial<EnhancedCrumb['breadcrumb']> = {}
): EnhancedCrumb {
  return {
    breadcrumb: {
      type: BreadcrumbType.HTTP,
      level: BreadcrumbLevelType.INFO,
      category: 'http',
      timestamp: '2024-01-15T10:30:45.123Z',
      message: 'GET request',
      data: {url: '/api/test', status_code: 200},
      ...overrides,
    },
  } as EnhancedCrumb;
}
describe('formatBreadcrumbsAsText', () => {
  it('formats a single breadcrumb with all fields', () => {
    const crumb = createMockCrumb();
    const result = formatBreadcrumbsAsText([crumb]);
    expect(result).toMatchInlineSnapshot(`
"Timestamp: 2024-01-15T10:30:45.123Z
Type: http
Category: http
Level: info
Message: GET request
Data: {"url":"/api/test","status_code":200}"
`);
  });
  it('formats multiple breadcrumbs separated by blank lines', () => {
    const crumb1 = createMockCrumb({message: 'First request'});
    const crumb2 = createMockCrumb({
      timestamp: '2024-01-15T10:30:46.000Z',
      message: 'Second request',
    });
    const result = formatBreadcrumbsAsText([crumb1, crumb2]);
    expect(result).toMatchInlineSnapshot(`
"Timestamp: 2024-01-15T10:30:45.123Z
Type: http
Category: http
Level: info
Message: First request
Data: {"url":"/api/test","status_code":200}

Timestamp: 2024-01-15T10:30:46.000Z
Type: http
Category: http
Level: info
Message: Second request
Data: {"url":"/api/test","status_code":200}"
`);
  });
});
describe('formatBreadcrumbsAsMarkdown', () => {
  it('formats breadcrumbs as a markdown table with header', () => {
    const crumb = createMockCrumb();
    const result = formatBreadcrumbsAsMarkdown([crumb]);
    expect(result).toMatchInlineSnapshot(`
"| Timestamp | Type | Category | Level | Message | Data |
|-----------|------|----------|-------|---------|------|
| 2024-01-15T10:30:45.123Z | http | http | info | GET request | {"url":"/api/test","status_code":200} |"
`);
  });
  it('escapes pipe characters in message and data', () => {
    const crumb = createMockCrumb({message: 'value|with|pipes', data: {key: 'val|ue'}});
    const result = formatBreadcrumbsAsMarkdown([crumb]);
    expect(result).toMatchInlineSnapshot(`
"| Timestamp | Type | Category | Level | Message | Data |
|-----------|------|----------|-------|---------|------|
| 2024-01-15T10:30:45.123Z | http | http | info | value\\|with\\|pipes | {"key":"val\\|ue"} |"
`);
  });
});
