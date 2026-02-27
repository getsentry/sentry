const {describe, it, beforeEach, afterEach} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  findJsonFiles,
  parseFailures,
  buildCommentBody,
  COMMENT_MARKER,
  report,
} = require('./report-backend-test-failures');

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

function createArtifactDir(name, filename, content) {
  const dir = path.join(tmpDir, name);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, filename), content);
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
  return {
    calls,
    rest: {
      issues: {
        listComments: async params => {
          calls.push({method: 'listComments', params});
          return {data: existingComments};
        },
        createComment: async params => {
          calls.push({method: 'createComment', params});
        },
        updateComment: async params => {
          calls.push({method: 'updateComment', params});
        },
        deleteComment: async params => {
          calls.push({method: 'deleteComment', params});
        },
      },
    },
  };
}

function mockContext(prNumber = 123) {
  return {
    repo: {owner: 'getsentry', repo: 'sentry'},
    payload: {pull_request: {number: prNumber}},
  };
}

// -- Tests -------------------------------------------------------------------

describe('findJsonFiles', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pytest-report-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  });

  it('finds json files in nested directories', () => {
    createArtifactDir('pytest-results-backend-111-0', 'pytest.json', '{}');
    createArtifactDir('pytest-results-backend-111-1', 'pytest.json', '{}');
    createArtifactDir('pytest-results-migration-111', 'pytest.json', '{}');

    const files = findJsonFiles(tmpDir);
    assert.equal(files.length, 3);
    assert.ok(files.every(f => f.endsWith('.json')));
  });

  it('returns empty array for nonexistent directory', () => {
    assert.deepEqual(findJsonFiles('/nonexistent/path'), []);
  });

  it('ignores non-json files', () => {
    createArtifactDir('pytest-results-backend-111-0', 'readme.txt', 'hi');
    createArtifactDir('pytest-results-backend-111-0', 'pytest.json', '{}');

    const files = findJsonFiles(tmpDir);
    assert.equal(files.length, 1);
    assert.ok(files[0].endsWith('.json'));
  });
});

describe('parseFailures', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pytest-report-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  });

  it('extracts failed tests and ignores passing ones', () => {
    createArtifactDir(
      'pytest-results-backend-111-0',
      'pytest.json',
      makePytestJson([FAILED_TEST, PASSED_TEST])
    );

    const files = findJsonFiles(tmpDir);
    const failures = parseFailures(files, mockCore());

    assert.equal(failures.length, 1);
    assert.equal(failures[0].nodeid, FAILED_TEST.nodeid);
    assert.ok(failures[0].longrepr.includes('assert response.status_code'));
  });

  it('handles setup failures (no call phase)', () => {
    createArtifactDir(
      'pytest-results-backend-111-0',
      'pytest.json',
      makePytestJson([SETUP_FAILURE])
    );

    const files = findJsonFiles(tmpDir);
    const failures = parseFailures(files, mockCore());

    assert.equal(failures.length, 1);
    assert.ok(failures[0].longrepr.includes('fixture error'));
  });

  it('skips corrupt json with a warning', () => {
    createArtifactDir('pytest-results-backend-111-0', 'pytest.json', 'NOT VALID JSON');

    const files = findJsonFiles(tmpDir);
    const core = mockCore();
    const failures = parseFailures(files, core);

    assert.equal(failures.length, 0);
    assert.equal(core.logs.warning.length, 1);
    assert.ok(core.logs.warning[0].includes('Skipping'));
  });

  it('skips json without tests array', () => {
    createArtifactDir(
      'pytest-results-backend-111-0',
      'pytest.json',
      JSON.stringify({summary: {}})
    );

    const files = findJsonFiles(tmpDir);
    const failures = parseFailures(files, mockCore());
    assert.equal(failures.length, 0);
  });

  it('aggregates failures across multiple files', () => {
    createArtifactDir(
      'pytest-results-backend-111-0',
      'pytest.json',
      makePytestJson([FAILED_TEST])
    );
    createArtifactDir(
      'pytest-results-backend-111-1',
      'pytest.json',
      makePytestJson([
        {
          ...FAILED_TEST,
          nodeid: 'tests/sentry/api/test_other.py::TestOther::test_boom',
        },
      ])
    );

    const files = findJsonFiles(tmpDir);
    const failures = parseFailures(files, mockCore());

    assert.equal(failures.length, 2);
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

    const body = buildCommentBody(failures);

    assert.ok(body.startsWith(COMMENT_MARKER));
    assert.ok(body.includes('## Backend Test Failures'));
    assert.ok(body.includes('The following tests failed:'));
    assert.ok(body.includes('<details>'));
    assert.ok(
      body.includes('<code>tests/sentry/api/test_foo.py::TestFoo::test_bar</code>')
    );
    assert.ok(body.includes('full traceback here'));
  });

  it('shows "No traceback available" when longrepr is empty', () => {
    const failures = [{nodeid: 'a::b::c', longrepr: ''}];

    const body = buildCommentBody(failures);
    assert.ok(body.includes('No traceback available'));
  });

  it('truncates long tracebacks', () => {
    const longTrace = Array.from({length: 100}, (_, i) => `line ${i}`).join('\n');
    const failures = [{nodeid: 'a::b::c', longrepr: longTrace}];

    const body = buildCommentBody(failures);
    assert.ok(body.includes('... (50 more lines)'));
    assert.ok(!body.includes('line 99'));
  });

  it('caps at 30 failures with overflow note', () => {
    const failures = Array.from({length: 35}, (_, i) => ({
      nodeid: `a::b::test_${i}`,
      longrepr: '',
    }));

    const body = buildCommentBody(failures);
    assert.ok(body.includes('test_29'));
    assert.ok(!body.includes('test_30'));
    assert.ok(body.includes('... and 5 more failures.'));
  });

  it('truncates body exceeding 65K chars', () => {
    const hugeTrace = 'x'.repeat(3000);
    const failures = Array.from({length: 30}, (_, i) => ({
      nodeid: `a::b::test_${i}`,
      longrepr: hugeTrace,
    }));

    const body = buildCommentBody(failures);
    assert.ok(body.length <= 65100);
    assert.ok(body.includes('truncated due to GitHub comment size limit'));
  });
});

describe('report (integration)', () => {
  let origEnv;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pytest-report-'));
    origEnv = process.env.GITHUB_WORKSPACE;
    process.env.GITHUB_WORKSPACE = tmpDir;
  });
  afterEach(() => {
    process.env.GITHUB_WORKSPACE = origEnv;
    fs.rmSync(tmpDir, {recursive: true, force: true});
  });

  it('creates a comment when failures exist', async () => {
    createArtifactDir(
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
  });

  it('updates an existing comment', async () => {
    createArtifactDir(
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

  it('deletes existing comment when all tests pass', async () => {
    createArtifactDir(
      'pytest-results-backend-111-0',
      'pytest.json',
      makePytestJson([PASSED_TEST])
    );

    const github = mockGithub({
      existingComments: [{id: 888, body: `${COMMENT_MARKER}\nold failures`}],
    });

    await report({github, context: mockContext(), core: mockCore()});

    const del = github.calls.find(c => c.method === 'deleteComment');
    assert.ok(del, 'should have called deleteComment');
    assert.equal(del.params.comment_id, 888);
  });

  it('does nothing when no artifacts exist', async () => {
    const github = mockGithub();
    const core = mockCore();

    await report({github, context: mockContext(), core});

    assert.equal(github.calls.length, 0);
    assert.ok(core.logs.info.some(m => m.includes('No pytest result files')));
  });

  it('does not delete when all pass and no prior comment', async () => {
    createArtifactDir(
      'pytest-results-backend-111-0',
      'pytest.json',
      makePytestJson([PASSED_TEST])
    );

    const github = mockGithub();
    const core = mockCore();

    await report({github, context: mockContext(), core});

    assert.ok(!github.calls.some(c => c.method === 'deleteComment'));
    assert.ok(!github.calls.some(c => c.method === 'createComment'));
  });
});
