import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, it} from 'node:test';

import {
  buildCommentBody,
  COMMENT_MARKER,
  parseFailures,
  report,
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

function mockCore() {
  const logs = {info: [], warning: []};
  return {
    info: msg => logs.info.push(msg),
    warning: msg => logs.warning.push(msg),
    logs,
  };
}

function mockGithub({existingComments = []} = {}) {
  const calls = [];
  const mock = {
    calls,
    paginate: async (method, params) => {
      calls.push({method: 'paginate', params});
      return existingComments;
    },
    rest: {
      issues: {
        createComment: async params => {
          calls.push({method: 'createComment', params});
        },
        updateComment: async params => {
          calls.push({method: 'updateComment', params});
        },
      },
    },
  };
  return mock;
}

function mockContext(prNumber = 123) {
  return {
    repo: {owner: 'getsentry', repo: 'sentry'},
    payload: {pull_request: {number: prNumber}},
    runId: 99,
  };
}

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
      makePytestJson([
        {
          ...FAILED_TEST,
          nodeid: 'tests/sentry/api/test_other.py::TestOther::test_boom',
        },
      ])
    );

    assert.equal(parseFailures([file1, file2], mockCore()).length, 2);
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

    const body = buildCommentBody(
      failures,
      'https://github.com/getsentry/sentry/actions/runs/99'
    );

    assert.ok(body.startsWith(COMMENT_MARKER));
    assert.ok(body.includes('## Backend Test Failures'));
    assert.ok(
      body.includes('[this run](https://github.com/getsentry/sentry/actions/runs/99)')
    );
    assert.ok(body.includes('<details>'));
    assert.ok(
      body.includes('<code>tests/sentry/api/test_foo.py::TestFoo::test_bar</code>')
    );
    assert.ok(body.includes('full traceback here'));
  });

  it('shows "No traceback available" when longrepr is empty', () => {
    const body = buildCommentBody(
      [{nodeid: 'a::b::c', longrepr: ''}],
      'https://example.com/run'
    );
    assert.ok(body.includes('No traceback available'));
  });

  it('truncates long tracebacks', () => {
    const longTrace = Array.from({length: 100}, (_, i) => `line ${i}`).join('\n');
    const body = buildCommentBody(
      [{nodeid: 'a::b::c', longrepr: longTrace}],
      'https://example.com/run'
    );
    assert.ok(body.includes('... (50 more lines)'));
    assert.ok(!body.includes('line 99'));
  });

  it('caps at 30 failures with overflow note', () => {
    const failures = Array.from({length: 35}, (_, i) => ({
      nodeid: `a::b::test_${i}`,
      longrepr: '',
    }));

    const body = buildCommentBody(failures, 'https://example.com/run');
    assert.ok(body.includes('test_29'));
    assert.ok(!body.includes('test_30'));
    assert.ok(body.includes('... and 5 more failures.'));
  });

  it('truncates body exceeding 65K chars', () => {
    const failures = Array.from({length: 30}, (_, i) => ({
      nodeid: `a::b::test_${i}`,
      longrepr: 'x'.repeat(3000),
    }));

    const body = buildCommentBody(failures, 'https://example.com/run');
    assert.ok(body.length <= 65100);
    assert.ok(body.includes('truncated due to GitHub comment size limit'));
  });
});

describe('report (integration)', () => {
  let origEnv;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'pytest-report-'));
    origEnv = process.env.GITHUB_WORKSPACE;
    process.env.GITHUB_WORKSPACE = tmpDir;
  });
  afterEach(() => {
    process.env.GITHUB_WORKSPACE = origEnv;
    rmSync(tmpDir, {recursive: true, force: true});
  });

  it('creates a comment when failures exist', async () => {
    createArtifactFile(
      'pytest-results-backend-111-0',
      'pytest.json',
      makePytestJson([FAILED_TEST])
    );

    const github = mockGithub();
    const core = mockCore();

    await report({github, context: mockContext(), core});

    const create = github.calls.find(c => c.method === 'createComment');
    assert.ok(create, 'should have called createComment');
    assert.equal(create.params.issue_number, 123);
    assert.ok(create.params.body.includes(COMMENT_MARKER));
    assert.ok(create.params.body.includes(FAILED_TEST.nodeid));
    assert.ok(create.params.body.includes('actions/runs/99'));
  });

  it('updates an existing comment', async () => {
    createArtifactFile(
      'pytest-results-backend-111-0',
      'pytest.json',
      makePytestJson([FAILED_TEST])
    );

    const github = mockGithub({
      existingComments: [{id: 999, body: `${COMMENT_MARKER}\nold content`}],
    });

    await report({github, context: mockContext(), core: mockCore()});

    const update = github.calls.find(c => c.method === 'updateComment');
    assert.ok(update, 'should have called updateComment');
    assert.equal(update.params.comment_id, 999);
    assert.ok(!github.calls.some(c => c.method === 'createComment'));
  });

  it('does nothing when no artifacts exist', async () => {
    const github = mockGithub();
    const core = mockCore();

    await report({github, context: mockContext(), core});

    assert.equal(github.calls.length, 0);
    assert.ok(core.logs.info.some(m => m.includes('No pytest result files')));
  });

  it('does nothing when all tests pass', async () => {
    createArtifactFile(
      'pytest-results-backend-111-0',
      'pytest.json',
      makePytestJson([PASSED_TEST])
    );

    const github = mockGithub();
    const core = mockCore();

    await report({github, context: mockContext(), core});

    assert.ok(!github.calls.some(c => c.method === 'createComment'));
    assert.ok(!github.calls.some(c => c.method === 'updateComment'));
  });
});
