import {
  InvestigationBlockExecutionFixture,
  InvestigationBlockFixture,
  InvestigationCommentFixture,
  InvestigationDetailFixture,
  InvestigationQueryOutputFixture,
} from 'sentry/views/investigations/fixtures';

const ADA = {
  id: 'story-ada',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  username: 'ada@example.com',
  ip_address: '127.0.0.1',
};
const GRACE = {
  id: 'story-grace',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  username: 'grace@example.com',
  ip_address: '127.0.0.1',
};
const KATHERINE = {
  id: 'story-katherine',
  name: 'Katherine Johnson',
  email: 'katherine@example.com',
  username: 'katherine@example.com',
  ip_address: '127.0.0.1',
};

export const commentStoryAuthors = {ADA, GRACE, KATHERINE};

export const commentedInvestigation = InvestigationDetailFixture({
  id: 'commented-invoice-timeouts',
  title: 'Invoice PDF timeouts in eu-west-1',
  status: 'active',
  sourceType: 'manual',
  dateCreated: '2026-08-27T14:08:00Z',
  dateUpdated: '2026-08-27T15:22:15Z',
  version: 4,
  blocks: [
    InvestigationBlockFixture({
      id: 'commented-notes',
      title: 'Initial notes',
      content:
        'Support reports that invoice exports began timing out after 13:40 UTC. So far the reports are limited to eu-west-1.',
    }),
    InvestigationBlockFixture({
      id: 'commented-query',
      position: 1,
      kind: 'query',
      title: 'Invoice generation duration',
      content: '',
      display: {type: 'table'},
      outputStatus: 'completed',
      output: InvestigationQueryOutputFixture({
        tableMarkdown:
          '| Region | p50 | p95 | Failure rate |\n| --- | ---: | ---: | ---: |\n| eu-west-1 | 2.1s | 31.4s | 12.8% |\n| us-east-1 | 1.9s | 4.2s | 0.3% |',
      }),
      currentExecution: InvestigationBlockExecutionFixture({id: 'commented-query-run'}),
    }),
    InvestigationBlockFixture({
      id: 'commented-theory',
      position: 2,
      title: 'Working theory',
      content:
        'The eu-west-1 PDF workers scaled down at 13:38, so exports queue behind the remaining workers until they time out.',
    }),
  ],
});

/**
 * A page comment, a thread on the query block, a comment on a deleted block, and
 * one from a deleted author.
 */
export const commentedInvestigationComments = [
  InvestigationCommentFixture({
    id: 'comment-query-reply-2',
    blockId: 'commented-query',
    author: KATHERINE,
    body: 'Confirmed. Reverting the minimum instance count now.',
    dateCreated: '2026-08-27T15:18:00Z',
    dateUpdated: '2026-08-27T15:18:00Z',
  }),
  InvestigationCommentFixture({
    id: 'comment-query-reply-1',
    blockId: 'commented-query',
    author: GRACE,
    body: "Yesterday's config push lowered the eu-west-1 worker minimum from `4` to `1`.",
    dateCreated: '2026-08-27T15:11:00Z',
    dateUpdated: '2026-08-27T15:11:00Z',
  }),
  InvestigationCommentFixture({
    id: 'comment-page-latest',
    author: GRACE,
    body: 'Pulled in the billing on-call. They see the same timeouts in the invoice worker logs.',
    dateCreated: '2026-08-27T15:20:00Z',
    dateUpdated: '2026-08-27T15:20:00Z',
  }),
  InvestigationCommentFixture({
    id: 'comment-query',
    blockId: 'commented-query',
    author: ADA,
    body: 'p95 jumps right at 13:40, which lines up with the worker autoscaling change.',
    dateCreated: '2026-08-27T15:05:00Z',
    dateUpdated: '2026-08-27T15:05:00Z',
  }),
  InvestigationCommentFixture({
    id: 'comment-notes',
    blockId: 'commented-notes',
    author: KATHERINE,
    body: 'Two more tickets from **eu-west-1** since this morning:\n\n- March invoice export\n- Q2 bulk download',
    dateCreated: '2026-08-27T14:40:00Z',
    dateUpdated: '2026-08-27T14:40:00Z',
  }),
  InvestigationCommentFixture({
    id: 'comment-deleted-block',
    blockId: 'deleted-cdn-check',
    author: GRACE,
    body: 'Not the CDN. Cache hit rate is flat across the window.',
    dateCreated: '2026-08-27T14:25:00Z',
    dateUpdated: '2026-08-27T14:25:00Z',
  }),
  InvestigationCommentFixture({
    id: 'comment-deleted-author',
    author: null,
    body: 'Opened this from the support escalation.',
    dateCreated: '2026-08-27T14:10:00Z',
    dateUpdated: '2026-08-27T14:10:00Z',
  }),
];
