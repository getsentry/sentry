import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, it} from 'node:test';

import {
  buildCommentBody,
  buildFailureBlocks,
  COMMENT_MARKER,
  commitMarker,
  extractNodeids,
  parseFailures,
  reportShard,
} from './report-backend-test-failures.js';

// -- Fixtures ----------------------------------------------------------------

function makePytestJson(tests) {
  return JSON.stringify({tests});
}

const FAILED_TEST = {
  nodeid: 'tests/sentry/api/test_foo.py::TestFoo::test_bar',
  outcome: 'failed',
  call: {
    status: 'failed',
    duration: 0.123,
    longrepr:
      'def test_bar():\n>       assert response.status_code == 200\nE       AssertionError: assert 500 == 200',
    crash: {
      path: '/src/tests/sentry/api/test_foo.py',
      lineno: 42,
      message: 'AssertionError: assert 500 == 200',
    },
  },
};

const FAILED_TEST_2 = {
  nodeid: 'tests/sentry/api/test_other.py::TestOther::test_boom',
  outcome: 'failed',
  call: {
    status: 'failed',
    duration: 0.05,
    longrepr: 'AssertionError: boom',
    crash: {path: '/src/tests/sentry/api/test_other.py', lineno: 10, message: 'boom'},
  },
};

const PASSED_TEST = {
  nodeid: 'tests/sentry/api/test_foo.py::TestFoo::test_ok',
  outcome: 'passed',
  call: {status: 'passed', duration: 0.01},
};

const SETUP_FAILURE = {
  nodeid: 'tests/sentry/api/test_baz.py::TestBaz::test_setup_boom',
  outcome: 'failed',
  setup: {
    status: 'failed',
    longrepr: 'fixture error\nKeyError: "missing"',
    crash: {
      path: '/src/conftest.py',
      lineno: 10,
      message: 'KeyError: "missing"',
    },
  },
};

// -- Helpers -----------------------------------------------------------------

let tmpDir;

function createArtifactFile(artifactDir, filename, content) {
  const dir = join(tmpDir, artifactDir);
  mkdirSync(dir, {recursive: true});
  const filePath = join(dir, filename);
  writeFileSync(filePath, content);
  return filePath;
}

function writePytestJson(filename, tests) {
  const filePath = join(tmpDir, filename);
  writeFileSync(filePath, makePytestJson(tests));
  return filePath;
}

function mockCore() {
  const logs = {info: [], warning: []};
  return {
    info: msg => logs.info.push(msg),
    warning: msg => logs.warning.push(msg),
    logs,
  };
}

function mockGithub({existingComments = [], jobs = []} = {}) {
  const calls = [];

  function listComments(params) {
    calls.push({method: 'listComments', params});
    return Promise.resolve({data: existingComments});
  }
  function listJobsForWorkflowRun(params) {
    calls.push({method: 'listJobsForWorkflowRun', params});
    return Promise.resolve({data: jobs});
  }

  return {
    calls,
    paginate: async (method, params) => {
      calls.push({method: 'paginate', params});
      if (method === listComments) return existingComments;
      if (method === listJobsForWorkflowRun) return jobs;
      return [];
    },
    rest: {
      issues: {
        listComments,
        createComment: async params => {
          calls.push({method: 'createComment', params});
        },
        updateComment: async params => {
          calls.push({method: 'updateComment', params});
        },
      },
      actions: {
        listJobsForWorkflowRun,
      },
    },
  };
}

function mockContext(prNumber = 123) {
  return {
    repo: {owner: 'getsentry', repo: 'sentry'},
    payload: {pull_request: {number: prNumber}},
    runId: 99,
    sha: 'abc1234567890def1234567890abcdef12345678',
  };
}

const TEST_SHA = 'abc1234567890def1234567890abcdef12345678';
const TEST_OPTS = {
  runUrl: 'https://example.com/run',
  sha: TEST_SHA,
  repoUrl: 'https://github.com/getsentry/sentry',
};

// -- Tests -------------------------------------------------------------------

describe('parseFailures', () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'pytest-report-'));
  });
  afterEach(() => {
    rmSync(tmpDir, {recursive: true, force: true});
  });

  it('extracts failed tests and ignores passing ones', () => {
    const file = createArtifactFile(
      'pytest-results-backend-111-0',
      'pytest.json',
      makePytestJson([FAILED_TEST, PASSED_TEST])
    );

    const failures = parseFailures([file], mockCore());

    assert.equal(failures.length, 1);
    assert.equal(failures[0].nodeid, FAILED_TEST.nodeid);
    assert.ok(failures[0].longrepr.includes('assert response.status_code'));
  });

  it('records the artifact directory for each failure', () => {
    const file = createArtifactFile(
      'pytest-results-backend-111-3',
      'pytest.json',
      makePytestJson([FAILED_TEST])
    );

    const failures = parseFailures([file], mockCore());

    assert.equal(failures[0].artifactDir, 'pytest-results-backend-111-3');
  });

  it('handles setup failures (no call phase)', () => {
    const file = createArtifactFile(
      'pytest-results-backend-111-0',
      'pytest.json',
      makePytestJson([SETUP_FAILURE])
    );

    const failures = parseFailures([file], mockCore());

    assert.equal(failures.length, 1);
    assert.ok(failures[0].longrepr.includes('fixture error'));
  });

  it('skips corrupt json with a warning', () => {
    const file = createArtifactFile(
      'pytest-results-backend-111-0',
      'pytest.json',
      'NOT VALID JSON'
    );

    const core = mockCore();
    const failures = parseFailures([file], core);

    assert.equal(failures.length, 0);
    assert.equal(core.logs.warning.length, 1);
    assert.ok(core.logs.warning[0].includes('Skipping'));
  });

  it('skips json without tests array', () => {
    const file = createArtifactFile(
      'pytest-results-backend-111-0',
      'pytest.json',
      JSON.stringify({summary: {}})
    );

    assert.equal(parseFailures([file], mockCore()).length, 0);
  });

  it('aggregates failures across multiple files', () => {
    const file1 = createArtifactFile(
      'pytest-results-backend-111-0',
      'pytest.json',
      makePytestJson([FAILED_TEST])
    );
    const file2 = createArtifactFile(
      'pytest-results-backend-111-1',
      'pytest.json',
      makePytestJson([FAILED_TEST_2])
    );

    assert.equal(parseFailures([file1, file2], mockCore()).length, 2);
  });
});

describe('extractNodeids', () => {
  it('returns empty set for null/undefined', () => {
    assert.equal(extractNodeids(null).size, 0);
    assert.equal(extractNodeids(undefined).size, 0);
  });

  it('extracts nodeids from <code> tags in comment body', () => {
    const body = buildCommentBody(
      [
        {nodeid: 'tests/foo.py::A::test_1', longrepr: ''},
        {nodeid: 'tests/bar.py::B::test_2', longrepr: ''},
      ],
      TEST_OPTS
    );

    const nodeids = extractNodeids(body);
    assert.ok(nodeids.has('tests/foo.py::A::test_1'));
    assert.ok(nodeids.has('tests/bar.py::B::test_2'));
    assert.equal(nodeids.size, 2);
  });
});

describe('buildFailureBlocks', () => {
  it('renders a details block per failure', () => {
    const blocks = buildFailureBlocks([{nodeid: 'a::b::c', longrepr: 'traceback here'}]);
    assert.ok(blocks.includes('<details>'));
    assert.ok(blocks.includes('<code>a::b::c</code>'));
    assert.ok(blocks.includes('traceback here'));
  });

  it('includes log link when jobUrl provided', () => {
    const blocks = buildFailureBlocks([
      {nodeid: 'a::b::c', longrepr: '', jobUrl: 'https://example.com/job/1'},
    ]);
    assert.ok(blocks.includes('— <a href="https://example.com/job/1">log</a>'));
  });

  it('omits log link when jobUrl absent', () => {
    const blocks = buildFailureBlocks([{nodeid: 'a::b::c', longrepr: ''}]);
    assert.ok(!blocks.includes('>log</a>'));
  });

  it('shows "No traceback available" for empty longrepr', () => {
    const blocks = buildFailureBlocks([{nodeid: 'a::b::c', longrepr: ''}]);
    assert.ok(blocks.includes('No traceback available'));
  });

  it('truncates long tracebacks', () => {
    const longTrace = Array.from({length: 100}, (_, i) => `line ${i}`).join('\n');
    const blocks = buildFailureBlocks([{nodeid: 'a::b::c', longrepr: longTrace}]);
    assert.ok(blocks.includes('... (50 more lines)'));
    assert.ok(!blocks.includes('line 99'));
  });
});

describe('buildCommentBody', () => {
  it('produces markdown with header and collapsible tracebacks', () => {
    const failures = [
      {
        nodeid: 'tests/sentry/api/test_foo.py::TestFoo::test_bar',
        longrepr: 'full traceback here',
      },
    ];

    const body = buildCommentBody(failures, {
      runUrl: 'https://github.com/getsentry/sentry/actions/runs/99',
      sha: TEST_SHA,
      repoUrl: 'https://github.com/getsentry/sentry',
    });

    assert.ok(body.startsWith(COMMENT_MARKER));
    assert.ok(body.includes(commitMarker(TEST_SHA)));
    assert.ok(body.includes('## Backend Test Failures'));
    assert.ok(
      body.includes('[this run](https://github.com/getsentry/sentry/actions/runs/99)')
    );
    assert.ok(body.includes(`\`abc1234\``));
    assert.ok(body.includes('<details>'));
    assert.ok(
      body.includes('<code>tests/sentry/api/test_foo.py::TestFoo::test_bar</code>')
    );
    assert.ok(body.includes('full traceback here'));
  });

  it('caps at 30 failures with overflow note', () => {
    const failures = Array.from({length: 35}, (_, i) => ({
      nodeid: `a::b::test_${i}`,
      longrepr: '',
    }));

    const body = buildCommentBody(failures, TEST_OPTS);
    assert.ok(body.includes('test_29'));
    assert.ok(!body.includes('test_30'));
    assert.ok(body.includes('... and 5 more failures.'));
  });

  it('truncates body exceeding 65K chars', () => {
    const failures = Array.from({length: 30}, (_, i) => ({
      nodeid: `a::b::test_${i}`,
      longrepr: 'x'.repeat(3000),
    }));

    const body = buildCommentBody(failures, TEST_OPTS);
    assert.ok(body.length <= 65100);
    assert.ok(body.includes('truncated due to GitHub comment size limit'));
  });
});

describe('reportShard (integration)', () => {
  let origEnv;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'pytest-report-'));
    origEnv = {
      PYTEST_JSON_PATH: process.env.PYTEST_JSON_PATH,
      PYTEST_ARTIFACT_DIR: process.env.PYTEST_ARTIFACT_DIR,
    };
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(origEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmSync(tmpDir, {recursive: true, force: true});
  });

  it('creates a comment when the shard has failures', async () => {
    const jsonPath = writePytestJson('pytest.json', [FAILED_TEST]);
    process.env.PYTEST_JSON_PATH = jsonPath;
    process.env.PYTEST_ARTIFACT_DIR = 'pytest-results-backend-99-3';

    const github = mockGithub();
    await reportShard({github, context: mockContext(), core: mockCore()});

    const create = github.calls.find(c => c.method === 'createComment');
    assert.ok(create, 'should have called createComment');
    assert.ok(create.params.body.includes(COMMENT_MARKER));
    assert.ok(create.params.body.includes(FAILED_TEST.nodeid));
    assert.ok(create.params.body.includes('actions/runs/99'));
  });

  it('appends new failures to an existing comment', async () => {
    // Existing comment already has FAILED_TEST reported (same commit)
    const existingBody = buildCommentBody(
      [{nodeid: FAILED_TEST.nodeid, longrepr: 'old traceback'}],
      TEST_OPTS
    );

    const jsonPath = writePytestJson('pytest.json', [FAILED_TEST, FAILED_TEST_2]);
    process.env.PYTEST_JSON_PATH = jsonPath;
    delete process.env.PYTEST_ARTIFACT_DIR;

    const github = mockGithub({
      existingComments: [{id: 999, body: existingBody}],
    });
    await reportShard({github, context: mockContext(), core: mockCore()});

    const update = github.calls.find(c => c.method === 'updateComment');
    assert.ok(update, 'should have called updateComment');
    // FAILED_TEST already existed — only FAILED_TEST_2 should be appended
    assert.ok(update.params.body.includes(FAILED_TEST_2.nodeid));
    // Original content preserved
    assert.ok(update.params.body.includes(FAILED_TEST.nodeid));
  });

  it('skips when all failures are already in the comment', async () => {
    const existingBody = buildCommentBody(
      [{nodeid: FAILED_TEST.nodeid, longrepr: ''}],
      TEST_OPTS
    );

    const jsonPath = writePytestJson('pytest.json', [FAILED_TEST]);
    process.env.PYTEST_JSON_PATH = jsonPath;

    const github = mockGithub({existingComments: [{id: 999, body: existingBody}]});
    const core = mockCore();
    await reportShard({github, context: mockContext(), core});

    assert.ok(!github.calls.some(c => c.method === 'updateComment'));
    assert.ok(!github.calls.some(c => c.method === 'createComment'));
    assert.ok(core.logs.info.some(m => m.includes('already reported')));
  });

  it('does nothing when the shard has no failures', async () => {
    const jsonPath = writePytestJson('pytest.json', [PASSED_TEST]);
    process.env.PYTEST_JSON_PATH = jsonPath;

    const github = mockGithub();
    const core = mockCore();
    await reportShard({github, context: mockContext(), core});

    assert.equal(github.calls.length, 0);
    assert.ok(core.logs.info.some(m => m.includes('No failures')));
  });

  it('does nothing when PYTEST_JSON_PATH is not set', async () => {
    delete process.env.PYTEST_JSON_PATH;

    const github = mockGithub();
    const core = mockCore();
    await reportShard({github, context: mockContext(), core});

    assert.equal(github.calls.length, 0);
    assert.ok(core.logs.warning.some(m => m.includes('PYTEST_JSON_PATH')));
  });

  it('includes job log link when the shard job is matched', async () => {
    const jsonPath = writePytestJson('pytest.json', [FAILED_TEST]);
    process.env.PYTEST_JSON_PATH = jsonPath;
    process.env.PYTEST_ARTIFACT_DIR = 'pytest-results-backend-99-3';

    const github = mockGithub({
      jobs: [
        {
          name: 'backend test (3)',
          html_url: 'https://github.com/getsentry/sentry/actions/runs/99/jobs/55555',
        },
      ],
    });
    await reportShard({github, context: mockContext(), core: mockCore()});

    const create = github.calls.find(c => c.method === 'createComment');
    assert.ok(
      create.params.body.includes(
        '<a href="https://github.com/getsentry/sentry/actions/runs/99/jobs/55555">log</a>'
      )
    );
  });
});
