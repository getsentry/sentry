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
  it('returns empty string for empty array', () => {
    expect(formatBreadcrumbsAsText([])).toBe('');
  });

  it('formats a single breadcrumb with all fields', () => {
    const crumb = createMockCrumb();
    const result = formatBreadcrumbsAsText([crumb]);

    expect(result).toContain('Timestamp: 2024-01-15T10:30:45.123Z');
    expect(result).toContain('Type: http');
    expect(result).toContain('Category: http');
    expect(result).toContain('Level: info');
    expect(result).toContain('Message: GET request');
    expect(result).toContain('Data: {"url":"/api/test","status_code":200}');
  });

  it('formats multiple breadcrumbs separated by blank lines', () => {
    const crumb1 = createMockCrumb({message: 'First request'});
    const crumb2 = createMockCrumb({
      timestamp: '2024-01-15T10:30:46.000Z',
      message: 'Second request',
    });

    const result = formatBreadcrumbsAsText([crumb1, crumb2]);

    expect(result).toContain('Message: First request');
    expect(result).toContain('Message: Second request');
    // Breadcrumbs are separated by double newlines
    expect(result.split('\n\n')).toHaveLength(2);
  });

  it('handles breadcrumbs with missing optional fields', () => {
    const crumb = createMockCrumb({
      timestamp: undefined,
      category: undefined,
      message: undefined,
      data: undefined,
    });

    const result = formatBreadcrumbsAsText([crumb]);

    expect(result).not.toContain('Timestamp:');
    expect(result).not.toContain('Category:');
    expect(result).not.toContain('Message:');
    expect(result).not.toContain('Data:');
    expect(result).toContain('Type: http');
    expect(result).toContain('Level: info');
  });
});

describe('formatBreadcrumbsAsMarkdown', () => {
  it('returns empty string for empty array', () => {
    expect(formatBreadcrumbsAsMarkdown([])).toBe('');
  });

  it('formats breadcrumbs as a markdown table with header', () => {
    const crumb = createMockCrumb();
    const result = formatBreadcrumbsAsMarkdown([crumb]);

    expect(result).toContain('| Timestamp | Type | Category | Level | Message | Data |');
    expect(result).toContain('|-----------|------|----------|-------|---------|------|');
    expect(result).toContain('2024-01-15T10:30:45.123Z');
    expect(result).toContain('http');
    expect(result).toContain('info');
    expect(result).toContain('GET request');
  });

  it('escapes pipe characters in message and data', () => {
    const crumb = createMockCrumb({
      message: 'value|with|pipes',
      data: {key: 'val|ue'},
    });

    const result = formatBreadcrumbsAsMarkdown([crumb]);

    expect(result).toContain('value\\|with\\|pipes');
    expect(result).toContain('val\\|ue');
  });

  it('handles breadcrumbs with missing optional fields', () => {
    const crumb = createMockCrumb({
      timestamp: undefined,
      category: undefined,
      message: undefined,
      data: undefined,
    });

    const result = formatBreadcrumbsAsMarkdown([crumb]);

    // Should still produce valid table rows with empty cells
    expect(result).toContain('| Timestamp | Type | Category | Level | Message | Data |');
    expect(result).toContain('|  | http |  | info |  |  |');
  });
});
