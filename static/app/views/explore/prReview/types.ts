export interface CodeReviewEvent {
  commentsPosted: number | null;
  dateAdded: string;
  denialReason: string | null;
  id: string;
  organizationId: string;
  prAuthor: string | null;
  prNumber: number | null;
  prTitle: string | null;
  prUrl: string | null;
  rawEventAction: string;
  rawEventType: string;
  repositoryId: string;
  repositoryName: string | null;
  reviewCompletedAt: string | null;
  reviewStartedAt: string | null;
  seerRunId: string | null;
  sentToSeerAt: string | null;
  status: string;
  targetCommitSha: string | null;
  taskEnqueuedAt: string | null;
  trigger: string | null;
  triggerAt: string;
  triggerId: string | null;
  triggerUser: string | null;
  webhookReceivedAt: string | null;
  preflightCompletedAt?: string | null;
}

export interface CodeReviewPR {
  eventCount: number;
  lastActivity: string;
  latestStatus: string;
  latestTrigger: string | null;
  prAuthor: string | null;
  prNumber: number;
  prState: string | null;
  prTitle: string | null;
  prUrl: string | null;
  repositoryId: string;
  repositoryName: string | null;
  totalComments: number;
}

export interface CodeReviewPRSummary {
  avgReviewDurationMs: number | null;
  totalComments: number;
  totalFailed: number;
  totalReviews: number;
  totalSkipped: number;
}

export interface CodeReviewPRDetails {
  events: CodeReviewEvent[];
  prAuthor: string | null;
  prNumber: number;
  prState: string | null;
  prTitle: string | null;
  prUrl: string | null;
  repositoryId: string;
  repositoryName: string | null;
  summary: CodeReviewPRSummary;
}

export interface CodeReviewRepository {
  id: string;
  name: string;
}

export interface CodeReviewStats {
  repositories: CodeReviewRepository[];
  stats: {
    skippedPrs: number;
    topAuthors: Array<{author: string; prCount: number}>;
    totalAuthors: number;
    totalComments: number;
    totalPrs: number;
    totalReviews: number;
  };
  timeSeries: Array<{
    comments: number;
    date: string;
    prs: number;
    reviewed: number;
    skipped: number;
  }>;
}
