import {escapeIssueTagKey} from './utils';

describe('escapeIssueTagKey', () => {
  it('should escape conflicting tag keys', () => {
    expect(escapeIssueTagKey('status')).toBe('tags[status]');
    expect(escapeIssueTagKey('message')).toBe('tags[message]');
  });

  it('should not escape environment and project', () => {
    expect(escapeIssueTagKey('environment')).toBe('environment');
    expect(escapeIssueTagKey('project')).toBe('project');
  });
});
