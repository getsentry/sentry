/**
 * Utility for tracking seen issues in localStorage
 */

import type {Group} from 'sentry/types/group';

const SEEN_ISSUES_KEY = 'sentry-seen-issues';
const MAX_SEEN_ISSUES = 1000; // Limit to prevent localStorage bloat

interface SeenIssue {
  id: string;
  // timestamp
  issue: Group;
  lastSeen: number; // Store full issue data
}

/**
 * Get all seen issue IDs
 */
function getSeenIssues(): SeenIssue[] {
  try {
    const stored = localStorage.getItem(SEEN_ISSUES_KEY);
    if (!stored) {
      return [];
    }

    const allSeenIssues: SeenIssue[] = JSON.parse(stored);
    return allSeenIssues.sort((a, b) => b.lastSeen - a.lastSeen);
  } catch (error) {
    return [];
  }
}

/**
 * Mark an issue as seen
 */
export function markIssueSeen(issue: Group): void {
  const stored = localStorage.getItem(SEEN_ISSUES_KEY);
  const existingIssues: SeenIssue[] = stored ? JSON.parse(stored) : [];

  // Remove existing entry if it exists
  const filteredIssues = existingIssues.filter(seenIssue => seenIssue.id !== issue.id);

  // Add new entry
  const newSeenIssue: SeenIssue = {
    id: issue.id,
    lastSeen: Date.now(),
    issue,
  };

  // Keep only the most recent entries to prevent localStorage bloat
  const updatedIssues = [newSeenIssue, ...filteredIssues]
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, MAX_SEEN_ISSUES);

  localStorage.setItem(SEEN_ISSUES_KEY, JSON.stringify(updatedIssues));
}

/**
 * Get all seen issue objects
 */
function getSeenIssueObjects(): Group[] {
  const stored = localStorage.getItem(SEEN_ISSUES_KEY);
  if (!stored) {
    return [];
  }

  const allSeenIssues: SeenIssue[] = JSON.parse(stored);
  return allSeenIssues.map(seenIssue => seenIssue.issue);
}

/**
 * Get seen issue IDs only (backward compatibility)
 */
function getSeenIssueIds(): string[] {
  const seenIssues = getSeenIssues();
  return seenIssues.map(issue => issue.id);
}

/**
 * Check if an issue has been seen
 */
function hasSeenIssue(issueId: string): boolean {
  const seenIssues = getSeenIssues();
  return seenIssues.some(issue => issue.id === issueId);
}

/**
 * Clear all seen issues (optional utility for user settings)
 */
function clearSeenIssues(): void {
  localStorage.removeItem(SEEN_ISSUES_KEY);
}

/**
 * Hook to use seen issues functionality
 */
export function useSeenIssues() {
  return {
    getSeenIssues,
    getSeenIssueObjects,
    getSeenIssueIds,
    markIssueSeen,
    hasSeenIssue,
    clearSeenIssues,
  };
}
