import {Fragment, useState} from 'react';

import {CodeBlock} from '@sentry/scraps/code';
import {Stack} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';
import {
  UptimeComparisonType,
  UptimeOpType,
  type UptimeHeaderCheckOp,
  type UptimeJsonPathOp,
  type UptimeLogicalOp,
  type UptimeStatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/types';

import {AddOpButton} from './addOpButton';
import {AssertionOpGroup} from './opGroup';
import {AssertionOpHeader} from './opHeader';
import {AssertionOpJsonPath} from './opJsonPath';
import {AssertionOpStatusCode} from './opStatusCode';

export default Storybook.story('Uptime Assertions', story => {
  story('Status Code Op', () => {
    const [statusCodeOp, setStatusCodeOp] = useState<UptimeStatusCodeOp>({
      id: 'story-status-1',
      op: UptimeOpType.STATUS_CODE_CHECK,
      operator: {cmp: UptimeComparisonType.EQUALS},
      value: 200,
    });

    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="AssertionOpStatusCode" /> component allows users to
          configure status code assertions with comparison operators.
        </p>
        <AssertionOpStatusCode
          value={statusCodeOp}
          onChange={setStatusCodeOp}
          onRemove={() => {}}
        />
        <CodeBlock language="javascript">
          {JSON.stringify(statusCodeOp, null, 2)}
        </CodeBlock>
      </Fragment>
    );
  });

  story('JSON Path Op', () => {
    const [jsonPathOp, setJsonPathOp] = useState<UptimeJsonPathOp>({
      id: 'story-json-1',
      op: UptimeOpType.JSON_PATH,
      value: '$.status',
      operator: {cmp: UptimeComparisonType.EQUALS},
      operand: {jsonpath_op: 'literal', value: 'ok'},
    });

    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="AssertionOpJsonPath" /> component allows users to
          configure JSON path assertions for response body validation.
        </p>
        <AssertionOpJsonPath
          value={jsonPathOp}
          onChange={setJsonPathOp}
          onRemove={() => {}}
        />
        <CodeBlock language="javascript">{JSON.stringify(jsonPathOp, null, 2)}</CodeBlock>
      </Fragment>
    );
  });

  story('JSON Path Op - Glob Pattern', () => {
    const [jsonPathOp, setJsonPathOp] = useState<UptimeJsonPathOp>({
      id: 'story-json-glob-1',
      op: UptimeOpType.JSON_PATH,
      value: '$.status',
      operator: {cmp: UptimeComparisonType.EQUALS},
      operand: {jsonpath_op: 'glob', pattern: {value: 'ok*'}},
    });

    return (
      <Fragment>
        <p>
          JSON path assertions can compare against glob patterns. The operand type
          selector allows switching between literal string matching and glob pattern
          matching.
        </p>
        <AssertionOpJsonPath
          value={jsonPathOp}
          onChange={setJsonPathOp}
          onRemove={() => {}}
        />
        <CodeBlock language="javascript">{JSON.stringify(jsonPathOp, null, 2)}</CodeBlock>
      </Fragment>
    );
  });

  story('Header Op - With Values', () => {
    const [headerOp, setHeaderOp] = useState<UptimeHeaderCheckOp>({
      id: 'story-header-1',
      op: UptimeOpType.HEADER_CHECK,
      key_op: {cmp: UptimeComparisonType.EQUALS},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: UptimeComparisonType.EQUALS},
      value_operand: {header_op: 'literal', value: 'application/json'},
    });

    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="AssertionOpHeader" /> component allows users to
          configure HTTP header assertions. When using equals/not_equal comparisons, both
          key and value inputs are shown with operand type selectors (literal/glob).
        </p>
        <AssertionOpHeader value={headerOp} onChange={setHeaderOp} onRemove={() => {}} />
        <CodeBlock language="javascript">{JSON.stringify(headerOp, null, 2)}</CodeBlock>
      </Fragment>
    );
  });

  story('Header Op - Always/Never', () => {
    const [headerOp, setHeaderOp] = useState<UptimeHeaderCheckOp>({
      id: 'story-header-2',
      op: UptimeOpType.HEADER_CHECK,
      key_op: {cmp: UptimeComparisonType.ALWAYS},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: UptimeComparisonType.ALWAYS},
      value_operand: {header_op: 'none'},
    });

    return (
      <Fragment>
        <p>
          When the key comparison is set to <code>always</code> or <code>never</code>, the
          value input field is hidden and the value comparison automatically matches the
          key comparison. The key operand is preserved to specify which header to check.
        </p>
        <AssertionOpHeader value={headerOp} onChange={setHeaderOp} onRemove={() => {}} />
        <CodeBlock language="javascript">{JSON.stringify(headerOp, null, 2)}</CodeBlock>
      </Fragment>
    );
  });

  story('Header Op - Glob Pattern', () => {
    const [headerOp, setHeaderOp] = useState<UptimeHeaderCheckOp>({
      id: 'story-header-3',
      op: UptimeOpType.HEADER_CHECK,
      key_op: {cmp: UptimeComparisonType.EQUALS},
      key_operand: {header_op: 'glob', pattern: {value: 'X-*'}},
      value_op: {cmp: UptimeComparisonType.NOT_EQUAL},
      value_operand: {header_op: 'glob', pattern: {value: '*error*'}},
    });

    return (
      <Fragment>
        <p>
          Headers can use glob patterns for matching. The operand type selector allows
          switching between literal string matching and glob pattern matching.
        </p>
        <AssertionOpHeader value={headerOp} onChange={setHeaderOp} onRemove={() => {}} />
        <CodeBlock language="javascript">{JSON.stringify(headerOp, null, 2)}</CodeBlock>
      </Fragment>
    );
  });

  story('Multiple Ops', () => {
    const [statusCodeOp, setStatusCodeOp] = useState<UptimeStatusCodeOp>({
      id: 'story-status-2',
      op: UptimeOpType.STATUS_CODE_CHECK,
      operator: {cmp: UptimeComparisonType.LESS_THAN},
      value: 400,
    });

    const [jsonPathOp, setJsonPathOp] = useState<UptimeJsonPathOp>({
      id: 'story-json-2',
      op: UptimeOpType.JSON_PATH,
      value: '$.error',
      operator: {cmp: UptimeComparisonType.EQUALS},
      operand: {jsonpath_op: 'literal', value: ''},
    });

    const [headerOp, setHeaderOp] = useState<UptimeHeaderCheckOp>({
      id: 'story-header-4',
      op: UptimeOpType.HEADER_CHECK,
      key_op: {cmp: UptimeComparisonType.EQUALS},
      key_operand: {header_op: 'literal', value: 'Content-Type'},
      value_op: {cmp: UptimeComparisonType.EQUALS},
      value_operand: {header_op: 'literal', value: 'application/json'},
    });

    return (
      <Fragment>
        <p>
          Multiple assertion operations can be combined to create complex validation
          rules.
        </p>
        <Stack gap="md">
          <AssertionOpStatusCode
            value={statusCodeOp}
            onChange={setStatusCodeOp}
            onRemove={() => {}}
          />
          <AssertionOpJsonPath
            value={jsonPathOp}
            onChange={setJsonPathOp}
            onRemove={() => {}}
          />
          <AssertionOpHeader
            value={headerOp}
            onChange={setHeaderOp}
            onRemove={() => {}}
          />
        </Stack>
      </Fragment>
    );
  });

  story('Add Op Button', () => {
    const [ops, setOps] = useState<Array<UptimeStatusCodeOp | UptimeJsonPathOp>>([]);

    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="AddOpButton" /> component provides a dropdown menu
          to add new assertion operations.
        </p>
        <Stack gap="md">
          <AddOpButton
            onAddOp={op => {
              setOps(prev => [...prev, op as UptimeStatusCodeOp | UptimeJsonPathOp]);
            }}
          />
          {ops.length > 0 && (
            <div>
              <h4>Added Operations:</h4>
              <Stack gap="sm">
                {ops.map((op, index) => (
                  <div key={index}>
                    {op.op === UptimeOpType.STATUS_CODE_CHECK ? (
                      <AssertionOpStatusCode
                        value={op}
                        onChange={newOp => {
                          setOps(prev => prev.map((o, i) => (i === index ? newOp : o)));
                        }}
                        onRemove={() => {
                          setOps(prev => prev.filter((_, i) => i !== index));
                        }}
                      />
                    ) : (
                      <AssertionOpJsonPath
                        value={op}
                        onChange={newOp => {
                          setOps(prev => prev.map((o, i) => (i === index ? newOp : o)));
                        }}
                        onRemove={() => {
                          setOps(prev => prev.filter((_, i) => i !== index));
                        }}
                      />
                    )}
                  </div>
                ))}
              </Stack>
            </div>
          )}
        </Stack>
      </Fragment>
    );
  });

  story('Group Op - Assert All (And)', () => {
    const [groupOp, setGroupOp] = useState<UptimeLogicalOp>({
      id: 'story-group-1',
      op: UptimeOpType.AND,
      children: [
        {
          id: 'story-status-3',
          op: UptimeOpType.STATUS_CODE_CHECK,
          operator: {cmp: UptimeComparisonType.LESS_THAN},
          value: 400,
        },
        {
          id: 'story-json-3',
          op: UptimeOpType.JSON_PATH,
          value: '$.success',
          operator: {cmp: UptimeComparisonType.EQUALS},
          operand: {jsonpath_op: 'literal', value: 'true'},
        },
      ],
    });

    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="AssertionOpGroup" /> component allows grouping
          multiple assertions with logical operators. "Assert All" requires all child
          assertions to pass.
        </p>
        <AssertionOpGroup value={groupOp} onChange={setGroupOp} />
        <CodeBlock language="javascript">{JSON.stringify(groupOp, null, 2)}</CodeBlock>
      </Fragment>
    );
  });

  story('Group Op - Assert Any (Or)', () => {
    const [groupOp, setGroupOp] = useState<UptimeLogicalOp>({
      id: 'story-group-2',
      op: UptimeOpType.OR,
      children: [
        {
          id: 'story-status-4',
          op: UptimeOpType.STATUS_CODE_CHECK,
          operator: {cmp: UptimeComparisonType.EQUALS},
          value: 200,
        },
        {
          id: 'story-status-5',
          op: UptimeOpType.STATUS_CODE_CHECK,
          operator: {cmp: UptimeComparisonType.EQUALS},
          value: 204,
        },
      ],
    });

    return (
      <Fragment>
        <p>
          "Assert Any" requires at least one child assertion to pass. The selector at the
          top allows switching between "Assert All" (and) and "Assert Any" (or).
        </p>
        <AssertionOpGroup value={groupOp} onChange={setGroupOp} />
        <CodeBlock language="javascript">{JSON.stringify(groupOp, null, 2)}</CodeBlock>
      </Fragment>
    );
  });

  story('Group Op - Assert Not All (Not And)', () => {
    const [groupOp, setGroupOp] = useState<UptimeLogicalOp>({
      id: 'story-not-1',
      op: UptimeOpType.NOT,
      operand: {
        id: 'story-group-3',
        op: UptimeOpType.AND,
        children: [
          {
            id: 'story-status-6',
            op: UptimeOpType.STATUS_CODE_CHECK,
            operator: {cmp: UptimeComparisonType.GREATER_THAN},
            value: 499,
          },
          {
            id: 'story-status-7',
            op: UptimeOpType.STATUS_CODE_CHECK,
            operator: {cmp: UptimeComparisonType.LESS_THAN},
            value: 600,
          },
        ],
      },
    });

    return (
      <Fragment>
        <p>
          "Assert Not All" fails if all child assertions pass (negated AND). This is
          useful for asserting that none of a set of conditions are met.
        </p>
        <AssertionOpGroup value={groupOp} onChange={setGroupOp} />
        <CodeBlock language="javascript">{JSON.stringify(groupOp, null, 2)}</CodeBlock>
      </Fragment>
    );
  });

  story('Group Op - Assert None (Not Or)', () => {
    const [groupOp, setGroupOp] = useState<UptimeLogicalOp>({
      id: 'story-not-2',
      op: UptimeOpType.NOT,
      operand: {
        id: 'story-group-4',
        op: UptimeOpType.OR,
        children: [
          {
            id: 'story-status-8',
            op: UptimeOpType.STATUS_CODE_CHECK,
            operator: {cmp: UptimeComparisonType.EQUALS},
            value: 404,
          },
          {
            id: 'story-status-9',
            op: UptimeOpType.STATUS_CODE_CHECK,
            operator: {cmp: UptimeComparisonType.EQUALS},
            value: 500,
          },
        ],
      },
    });

    return (
      <Fragment>
        <p>
          "Assert None" fails if any child assertion passes (negated OR). This is useful
          for ensuring that none of several error conditions occur.
        </p>
        <AssertionOpGroup value={groupOp} onChange={setGroupOp} />
        <CodeBlock language="javascript">{JSON.stringify(groupOp, null, 2)}</CodeBlock>
      </Fragment>
    );
  });

  story('Group Op - Nested Groups', () => {
    const [groupOp, setGroupOp] = useState<UptimeLogicalOp>({
      id: 'story-group-5',
      op: UptimeOpType.AND,
      children: [
        {
          id: 'story-status-10',
          op: UptimeOpType.STATUS_CODE_CHECK,
          operator: {cmp: UptimeComparisonType.LESS_THAN},
          value: 400,
        },
        {
          id: 'story-group-6',
          op: UptimeOpType.OR,
          children: [
            {
              id: 'story-json-4',
              op: UptimeOpType.JSON_PATH,
              value: '$.status',
              operator: {cmp: UptimeComparisonType.EQUALS},
              operand: {jsonpath_op: 'literal', value: 'ok'},
            },
            {
              id: 'story-header-5',
              op: UptimeOpType.HEADER_CHECK,
              key_op: {cmp: UptimeComparisonType.EQUALS},
              key_operand: {header_op: 'literal', value: 'X-Status'},
              value_op: {cmp: UptimeComparisonType.EQUALS},
              value_operand: {header_op: 'literal', value: 'ok'},
            },
          ],
        },
      ],
    });

    return (
      <Fragment>
        <p>
          Groups can be nested to create complex logical expressions. This example shows
          an "Assert All" group containing a status code check and a nested "Assert Any"
          group.
        </p>
        <AssertionOpGroup value={groupOp} onChange={setGroupOp} />
        <CodeBlock language="javascript">{JSON.stringify(groupOp, null, 2)}</CodeBlock>
      </Fragment>
    );
  });

  story('Group Op - Empty Group', () => {
    const [groupOp, setGroupOp] = useState<UptimeLogicalOp>({
      id: 'story-group-7',
      op: UptimeOpType.AND,
      children: [],
    });

    return (
      <Fragment>
        <p>
          Empty groups show only the type selector and the "Add Condition" button,
          allowing users to build assertions from scratch.
        </p>
        <AssertionOpGroup value={groupOp} onChange={setGroupOp} />
        <CodeBlock language="javascript">{JSON.stringify(groupOp, null, 2)}</CodeBlock>
      </Fragment>
    );
  });

  story('Root Group', () => {
    const [rootGroup, setRootGroup] = useState<UptimeLogicalOp>({
      id: 'story-group-8',
      op: UptimeOpType.AND,
      children: [
        {
          id: 'story-status-11',
          op: UptimeOpType.STATUS_CODE_CHECK,
          operator: {cmp: UptimeComparisonType.LESS_THAN},
          value: 400,
        },
        {
          id: 'story-json-5',
          op: UptimeOpType.JSON_PATH,
          value: '$.success',
          operator: {cmp: UptimeComparisonType.EQUALS},
          operand: {jsonpath_op: 'literal', value: 'true'},
        },
        {
          id: 'story-header-6',
          op: UptimeOpType.HEADER_CHECK,
          key_op: {cmp: UptimeComparisonType.EQUALS},
          key_operand: {header_op: 'literal', value: 'Content-Type'},
          value_op: {cmp: UptimeComparisonType.EQUALS},
          value_operand: {header_op: 'literal', value: 'application/json'},
        },
      ],
    });

    return (
      <Fragment>
        <p>
          The root group renders without the <code>GroupContainer</code> styling. It
          displays assertions in a simple stack with an "Add Assertion" button at the
          bottom. The root group is always an "and" operation and cannot be changed or
          removed.
        </p>
        <AssertionOpGroup value={rootGroup} onChange={setRootGroup} root />
        <CodeBlock language="javascript">{JSON.stringify(rootGroup, null, 2)}</CodeBlock>
      </Fragment>
    );
  });

  story('Root Group - Empty', () => {
    const [rootGroup, setRootGroup] = useState<UptimeLogicalOp>({
      id: 'story-group-9',
      op: UptimeOpType.AND,
      children: [],
    });

    return (
      <Fragment>
        <p>
          An empty root group shows only the "Add Assertion" button, providing a clean
          starting point for building assertions.
        </p>
        <AssertionOpGroup value={rootGroup} onChange={setRootGroup} root />
        <CodeBlock language="javascript">{JSON.stringify(rootGroup, null, 2)}</CodeBlock>
      </Fragment>
    );
  });

  story('Drag and Drop - Reordering', () => {
    const [rootGroup, setRootGroup] = useState<UptimeLogicalOp>({
      id: 'story-dnd-1',
      op: UptimeOpType.AND,
      children: [
        {
          id: 'story-status-dnd-1',
          op: UptimeOpType.STATUS_CODE_CHECK,
          operator: {cmp: UptimeComparisonType.LESS_THAN},
          value: 400,
        },
        {
          id: 'story-json-dnd-1',
          op: UptimeOpType.JSON_PATH,
          value: '$.success',
          operator: {cmp: UptimeComparisonType.EQUALS},
          operand: {jsonpath_op: 'literal', value: 'true'},
        },
        {
          id: 'story-header-dnd-1',
          op: UptimeOpType.HEADER_CHECK,
          key_op: {cmp: UptimeComparisonType.EQUALS},
          key_operand: {header_op: 'literal', value: 'Content-Type'},
          value_op: {cmp: UptimeComparisonType.EQUALS},
          value_operand: {header_op: 'literal', value: 'application/json'},
        },
      ],
    });

    return (
      <Fragment>
        <p>
          Assertions can be reordered using drag and drop. Click and drag the{' '}
          <strong>grip handle</strong> (⠿) next to each assertion label to reorder them.
          The tree structure updates in real-time as items are dragged.
        </p>
        <AssertionOpGroup value={rootGroup} onChange={setRootGroup} root />
        <CodeBlock language="javascript">{JSON.stringify(rootGroup, null, 2)}</CodeBlock>
      </Fragment>
    );
  });

  story('Drag and Drop - Between Groups', () => {
    const [rootGroup, setRootGroup] = useState<UptimeLogicalOp>({
      id: 'story-dnd-2',
      op: UptimeOpType.AND,
      children: [
        {
          id: 'story-status-dnd-2',
          op: UptimeOpType.STATUS_CODE_CHECK,
          operator: {cmp: UptimeComparisonType.LESS_THAN},
          value: 400,
        },
        {
          id: 'story-or-dnd-1',
          op: UptimeOpType.OR,
          children: [
            {
              id: 'story-json-dnd-2',
              op: UptimeOpType.JSON_PATH,
              value: '$.data.id',
              operator: {cmp: UptimeComparisonType.EQUALS},
              operand: {jsonpath_op: 'literal', value: '1234567890'},
            },
            {
              id: 'story-json-dnd-3',
              op: UptimeOpType.JSON_PATH,
              value: '$.data.name',
              operator: {cmp: UptimeComparisonType.EQUALS},
              operand: {jsonpath_op: 'literal', value: 'John Doe'},
            },
          ],
        },
        {
          id: 'story-header-dnd-2',
          op: UptimeOpType.HEADER_CHECK,
          key_op: {cmp: UptimeComparisonType.EQUALS},
          key_operand: {header_op: 'literal', value: 'X-Request-Id'},
          value_op: {cmp: UptimeComparisonType.ALWAYS},
          value_operand: {header_op: 'none'},
        },
      ],
    });

    return (
      <Fragment>
        <p>
          Assertions can be moved between groups. Drag an assertion from the root level
          into the nested "Assert Any" group, or drag items out of the group to the root
          level. You can also drag items into empty groups.
        </p>
        <AssertionOpGroup value={rootGroup} onChange={setRootGroup} root />
        <CodeBlock language="javascript">{JSON.stringify(rootGroup, null, 2)}</CodeBlock>
      </Fragment>
    );
  });
});
