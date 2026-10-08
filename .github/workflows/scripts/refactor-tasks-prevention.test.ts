import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {
  findingsInPatch,
  parseAddedLines,
  sparsePatterns,
  type Finding,
} from './refactor-tasks-prevention.ts';

const DIFF = `diff --git a/static/app/modified.tsx b/static/app/modified.tsx
index 1111111..2222222 100644
--- a/static/app/modified.tsx
+++ b/static/app/modified.tsx
@@ -3 +3 @@ import x from 'x';
-const a = 1;
+const a = 2;
@@ -10,0 +11,3 @@ function foo() {
+++ b/not-a-header.tsx
+@@ -1 +1 @@
+const c = 3;
@@ -20,2 +23,0 @@ function bar() {
-gone();
-gone();
diff --git a/static/app/new.tsx b/static/app/new.tsx
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/static/app/new.tsx
@@ -0,0 +1,2 @@
+export const x = 1;
+export const y = 2;
\\ No newline at end of file
diff --git a/static/app/deleted.tsx b/static/app/deleted.tsx
deleted file mode 100644
index 4444444..0000000
--- a/static/app/deleted.tsx
+++ /dev/null
@@ -1 +0,0 @@
-export const z = 1;
diff --git a/static/app/only-removals.tsx b/static/app/only-removals.tsx
index 5555555..6666666 100644
--- a/static/app/only-removals.tsx
+++ b/static/app/only-removals.tsx
@@ -4 +3,0 @@ function baz() {
-removed();
diff --git a/static/app/old-name.tsx b/static/app/renamed.tsx
similarity index 90%
rename from static/app/old-name.tsx
rename to static/app/renamed.tsx
index 7777777..8888888 100644
--- a/static/app/old-name.tsx
+++ b/static/app/renamed.tsx
@@ -7 +7 @@
-before();
+after();
`;

function makeFinding(file: string, line_start: number, line_end: number): Finding {
  return {
    confidence: 'high',
    explanation: 'explanation',
    file,
    line_end,
    line_start,
    pattern_name: 'no-class-components',
    severity: 'warning',
  };
}

describe('parseAddedLines', () => {
  it('maps each file to the lines the patch adds, in merge-commit numbering', () => {
    assert.deepEqual(
      parseAddedLines(DIFF),
      new Map([
        [
          'static/app/modified.tsx',
          [
            {start: 3, end: 3},
            {start: 11, end: 13},
          ],
        ],
        ['static/app/new.tsx', [{start: 1, end: 2}]],
        ['static/app/renamed.tsx', [{start: 7, end: 7}]],
      ])
    );
  });

  it('returns nothing for an empty patch', () => {
    assert.equal(parseAddedLines('').size, 0);
  });
});

describe('sparsePatterns', () => {
  it('keeps the config dir and patched files, and drops lint-path conventions', () => {
    assert.deepEqual(
      sparsePatterns(
        ['static/app/foo.tsx', 'static/app/[slug]/page*.tsx'],
        ['no-circular-dependencies.yaml']
      ),
      [
        '/.sentry-refactor-tasks/',
        '!/.sentry-refactor-tasks/conventions/no-circular-dependencies.yaml',
        '/static/app/foo.tsx',
        '/static/app/\\[slug]/page\\*.tsx',
      ]
    );
  });
});

describe('findingsInPatch', () => {
  const added = new Map([['static/app/modified.tsx', [{start: 11, end: 13}]]]);

  it('keeps findings that overlap an added line', () => {
    const findings = [
      makeFinding('static/app/modified.tsx', 13, 20),
      makeFinding('static/app/modified.tsx', 5, 11),
    ];
    assert.deepEqual(findingsInPatch(findings, added), findings);
  });

  it('drops findings on untouched lines or files', () => {
    assert.deepEqual(
      findingsInPatch(
        [
          makeFinding('static/app/modified.tsx', 1, 10),
          makeFinding('static/app/modified.tsx', 14, 30),
          makeFinding('static/app/untouched.tsx', 11, 13),
        ],
        added
      ),
      []
    );
  });
});
