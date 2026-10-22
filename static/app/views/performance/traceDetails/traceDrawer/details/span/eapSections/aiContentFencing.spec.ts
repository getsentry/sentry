import {fenceContent} from 'sentry/views/performance/traceDetails/traceDrawer/details/span/eapSections/aiContentFencing';

const FENCE = '```';

describe('fenceContent', () => {
  it('fences a standalone HTML block as an html code block', () => {
    expect(fenceContent('<div>markup</div>')).toBe(`

${FENCE}html
<div>markup</div>
${FENCE}

`);
  });

  it('fences a standalone JSON block as a json code block', () => {
    expect(fenceContent('{"a": 1, "b": 2}')).toBe(`

${FENCE}json
{"a": 1, "b": 2}
${FENCE}

`);
  });

  it('fences a Python-repr dict as a json code block', () => {
    expect(fenceContent("{'a': 1, 'b': 2}")).toBe(`

${FENCE}json
{'a': 1, 'b': 2}
${FENCE}

`);
  });

  it('fences a Python-repr dict with brackets inside a single-quoted value', () => {
    const input = "{'msg': 'oops }', 'tpl': 'Hello {name}'}";
    expect(fenceContent(input)).toBe(`

${FENCE}json
${input}
${FENCE}

`);
  });

  it('fences JSON with an apostrophe inside a double-quoted value', () => {
    const input = '{"note": "it\'s fine", "n": 1}';
    expect(fenceContent(input)).toBe(`

${FENCE}json
${input}
${FENCE}

`);
  });

  it('fences an attributed HTML block', () => {
    expect(fenceContent('<div class="box">hi</div>')).toBe(`

${FENCE}html
<div class="box">hi</div>
${FENCE}

`);
  });

  it('fences a multi-line HTML block as a single code block', () => {
    const input = `<ul>
  <li>one</li>
  <li>two</li>
</ul>`;
    expect(fenceContent(input)).toBe(`

${FENCE}html
${input}
${FENCE}

`);
  });

  it('fences a multi-line HTML block surrounded by prose', () => {
    const input = `Here is the markup:
<div>
  <span>hi</span>
</div>
Done.`;
    expect(fenceContent(input)).toBe(`Here is the markup:


${FENCE}html
<div>
  <span>hi</span>
</div>
${FENCE}


Done.`);
  });

  it('fences nested same-name HTML tags as one block, not truncated', () => {
    const input = '<div><div>inner</div></div>';
    expect(fenceContent(input)).toBe(`

${FENCE}html
${input}
${FENCE}

`);
  });

  it('fences a nested list without orphaning closing tags', () => {
    const input = `<ul>
  <li>one
    <ul>
      <li>nested</li>
    </ul>
  </li>
</ul>`;
    expect(fenceContent(input)).toBe(`

${FENCE}html
${input}
${FENCE}

`);
  });

  it('keeps a self-closing child inside its enclosing HTML block', () => {
    const input = '<div>one<br/>two</div>';
    expect(fenceContent(input)).toBe(`

${FENCE}html
${input}
${FENCE}

`);
  });

  it('does not fence a standalone self-closing tag', () => {
    expect(fenceContent('<br/>')).toBe('<br/>');
  });

  it('does not fence a standalone void element', () => {
    const input = '<img src="x">';
    expect(fenceContent(input)).toBe(input);
  });

  it('wraps JSON that has prose beside it in inline code', () => {
    expect(fenceContent('the payload {"a":1,"b":2} failed')).toBe(
      'the payload `{"a":1,"b":2}` failed'
    );
  });

  it('wraps JSON followed by a sentence period in inline code', () => {
    expect(fenceContent('See {"a": 1, "b": 2}.')).toBe('See `{"a": 1, "b": 2}`.');
  });

  it('wraps JSON followed by a comma in inline code', () => {
    expect(fenceContent('Given {"a": 1}, proceed')).toBe('Given `{"a": 1}`, proceed');
  });

  it('leaves JSON glued to other tokens untouched', () => {
    const input = 'call with key={"a":1,"b":2} now';
    expect(fenceContent(input)).toBe(input);
  });

  it('leaves trivial braces untouched', () => {
    const input = 'look at {} and [] here';
    expect(fenceContent(input)).toBe(input);
  });

  it('does not re-fence content already inside a code fence', () => {
    const input = `${FENCE}json
{"a":1}
${FENCE}`;
    expect(fenceContent(input)).toBe(input);
  });

  it('does not fence a block that ends inside an existing code fence', () => {
    const input = `<div>
${FENCE}js
const a = '</div>';
${FENCE}`;
    expect(fenceContent(input)).toBe(input);
  });

  it('does not fence unknown/custom tags as HTML', () => {
    const input = '<thinking>a deep thought</thinking>';
    expect(fenceContent(input)).toBe(input);
  });

  it('fences the outer HTML block, not JSON nested inside it', () => {
    const input = `<pre>
{"a": 1, "b": 2}
</pre>`;
    expect(fenceContent(input)).toBe(`

${FENCE}html
${input}
${FENCE}

`);
  });

  it('fences the outer JSON block, not HTML nested in a string value', () => {
    const input = `{
  "markup": "<div>x</div>"
}`;
    expect(fenceContent(input)).toBe(`

${FENCE}json
${input}
${FENCE}

`);
  });

  describe('diffs', () => {
    const fencedDiff = (diff: string) => `

${FENCE}diff
${diff}
${FENCE}

`;

    it('fences a unified diff with file headers', () => {
      const input = `--- a/app.py
+++ b/app.py
@@ -1,3 +1,3 @@
 def total(items):
-    return sum(items)
+    return sum(items, 0)
 # done`;
      expect(fenceContent(input)).toBe(fencedDiff(input));
    });

    it('fences a git diff with extended headers and several files', () => {
      const input = `diff --git a/a.txt b/a.txt
index 83db48f..bf269f4 100644
--- a/a.txt
+++ b/a.txt
@@ -1 +1 @@
-old
+new
diff --git a/b.txt b/b.txt
new file mode 100644
--- /dev/null
+++ b/b.txt
@@ -0,0 +1,2 @@
+one
+two`;
      expect(fenceContent(input)).toBe(fencedDiff(input));
    });

    it('fences a unified diff with several hunks', () => {
      const input = `--- a/x
+++ b/x
@@ -1,2 +1,2 @@
 a
-b
+B
@@ -10,2 +10,2 @@
 j
-k
+K`;
      expect(fenceContent(input)).toBe(fencedDiff(input));
    });

    it('ends a unified diff where the hunk counts end, keeping trailing prose', () => {
      const diff = `@@ -1,2 +1,2 @@
 keep
-before
+after`;
      expect(fenceContent(`Here is the patch:\n${diff}\n- this list item is prose`)).toBe(
        `Here is the patch:\n${fencedDiff(diff)}\n- this list item is prose`
      );
    });

    it('stops at the next file header once the hunk counts are used up', () => {
      const input = `--- a/x
+++ b/x
@@ -1 +1 @@
-a
+b
--- a/y
+++ b/y
@@ -1 +1 @@
-c
+d`;
      expect(fenceContent(input)).toBe(fencedDiff(input));
    });

    it('treats empty lines inside a counted hunk as context', () => {
      const input = `@@ -1,4 +1,4 @@
 first

-second
+SECOND
 third`;
      expect(fenceContent(input)).toBe(fencedDiff(input));
    });

    it('keeps reading body lines when the hunk counts are too small', () => {
      const input = `@@ -1,1 +1,1 @@
-a
+b
 c
+d`;
      expect(fenceContent(input)).toBe(fencedDiff(input));
    });

    it('fences a hunk with a count-less header', () => {
      const diff = `@@
 def foo():
-    return 1
+    return 2`;
      expect(fenceContent(`${diff}\n\nThat fixes it.`)).toBe(
        `${fencedDiff(diff)}\n\nThat fixes it.`
      );
    });

    it('does not treat a markdown list after a blank line as hunk body', () => {
      const diff = `@@
-a
+b`;
      expect(fenceContent(`${diff}\n\n- next step`)).toBe(
        `${fencedDiff(diff)}\n\n- next step`
      );
    });

    it('keeps the no-newline marker inside the hunk', () => {
      const input = `@@ -1 +1 @@
-a
\\ No newline at end of file
+b
\\ No newline at end of file`;
      expect(fenceContent(input)).toBe(fencedDiff(input));
    });

    it('handles CRLF line endings', () => {
      const input = '@@ -1 +1 @@\r\n-a\r\n+b';
      expect(fenceContent(input)).toBe(fencedDiff(input));
    });

    it('fences a context diff', () => {
      const input = `*** a/x.txt
--- b/x.txt
***************
*** 1,3 ****
  a
! b
  c
--- 1,3 ----
  a
! B
  c
***************
*** 10,11 ****
--- 10,12 ----
  j
+ inserted
  k`;
      expect(fenceContent(input)).toBe(fencedDiff(input));
    });

    it('fences a context diff whose new side is omitted', () => {
      const diff = `*** a/x.txt
--- b/x.txt
***************
*** 1,2 ****
  a
- b
--- 1 ----`;
      expect(fenceContent(`${diff}\nDone.`)).toBe(`${fencedDiff(diff)}\nDone.`);
    });

    it('keeps no-newline markers inside a context diff', () => {
      const input = `*** a/x.txt
--- b/x.txt
***************
*** 1,3 ****
  a
! b
  c
\\ No newline at end of file
--- 1,3 ----
  a
! B
  c
\\ No newline at end of file`;
      expect(fenceContent(input)).toBe(fencedDiff(input));
    });

    it('fences an apply_patch block up to its end marker', () => {
      const diff = `*** Begin Patch
*** Update File: src/app.py
@@ def total(items):
-    return sum(items)
+    return sum(items, 0)
*** End Patch`;
      expect(fenceContent(`Applying:\n${diff}\nok`)).toBe(
        `Applying:\n${fencedDiff(diff)}\nok`
      );
    });

    it('leaves an apply_patch block without an end marker to the other detectors', () => {
      const input = `*** Begin Patch
*** Update File: src/app.py`;
      expect(fenceContent(input)).toBe(input);
    });

    it('leaves file headers without any changes untouched', () => {
      const input = `--- a/x
+++ b/x
@@ -1 +1 @@
 same`;
      expect(fenceContent(input)).toBe(input);
    });

    it('leaves markdown lists and rules untouched', () => {
      const input = `Pros:
+ fast
- costly
---
+++ not a header`;
      expect(fenceContent(input)).toBe(input);
    });

    it('does not re-fence a diff already inside a code fence', () => {
      const input = `${FENCE}diff
@@ -1 +1 @@
-a
+b
${FENCE}`;
      expect(fenceContent(input)).toBe(input);
    });

    it('fences a diff whose lines contain inline code spans', () => {
      const diff = `--- a/query.py
+++ b/query.py
@@ -1,2 +1,2 @@
-    qs = values_list(\`id\`)
+    ids = values_list(\`id\`)
     # \`n\` will be \`None\` if \`qs\` is empty`;
      expect(fenceContent(`Uses \`bulk_delete_objects\`.\n\n${diff}`)).toBe(
        `Uses \`bulk_delete_objects\`.\n\n${fencedDiff(diff)}`
      );
    });

    it('fences a diff after an unpaired backtick in an earlier paragraph', () => {
      const diff = `@@ -1 +1 @@
-a \`x\`
+b`;
      expect(fenceContent(`A stray \` tick.\n\n${diff}`)).toBe(
        `A stray \` tick.\n\n${fencedDiff(diff)}`
      );
    });

    it('fences a diff after an unpaired backtick and a CRLF blank line', () => {
      const diff = '@@ -1 +1 @@\r\n-a\r\n+b';
      expect(
        fenceContent(`A stray \` tick.\r\n\r\n${diff}\r\n\r\nMore \` text`)
      ).toContain(`${FENCE}diff\n${diff}\n${FENCE}`);
    });

    it('fences the diff, not JSON or HTML inside its hunks', () => {
      const input = `@@ -1,4 +1,4 @@
 {
-  "a": 1
+  "a": 2
 }
-<div>old</div>
+<div>new</div>`;
      expect(fenceContent(input)).toBe(fencedDiff(input));
    });
  });
});
