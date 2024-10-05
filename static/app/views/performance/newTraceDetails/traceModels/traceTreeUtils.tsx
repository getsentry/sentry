// Returns a list of errors related to the txn with ids matching the span id

import {isTransactionNode} from '../traceGuards';

import type {TraceTree} from './traceTree';
import type {TraceTreeNode} from './traceTreeNode';

export function getRelatedSpanErrorsFromTransaction(
  span: TraceTree.Span,
  node: TraceTreeNode<TraceTree.NodeValue>
): TraceTree.TraceError[] {
  if (!isTransactionNode(node) || !node.value?.errors?.length) {
    return [];
  }

  const errors: TraceTree.TraceError[] = [];
  for (const error of node.value.errors) {
    if (error.span === span.span_id) {
      errors.push(error);
    }
  }

  return errors;
}

// Returns a list of performance errors related to the txn with ids matching the span id
export function getRelatedPerformanceIssuesFromTransaction(
  span: TraceTree.Span,
  node: TraceTreeNode<TraceTree.NodeValue>
): TraceTree.TracePerformanceIssue[] {
  if (!isTransactionNode(node) || !node.value?.performance_issues?.length) {
    return [];
  }

  const performanceIssues: TraceTree.TracePerformanceIssue[] = [];

  for (const perfIssue of node.value.performance_issues) {
    for (const s of perfIssue.span) {
      if (s === span.span_id) {
        performanceIssues.push(perfIssue);
      }
    }

    for (const suspect of perfIssue.suspect_spans) {
      if (suspect === span.span_id) {
        performanceIssues.push(perfIssue);
      }
    }
  }

  return performanceIssues;
}
