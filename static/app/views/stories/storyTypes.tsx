import {Fragment, useMemo, useState} from 'react';
import type {PropItem, Props} from 'react-docgen-typescript';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {fzf} from 'sentry/utils/profiling/fzf/fzf';

interface StoryTypesProps {
  types: TypeLoader.ComponentDocWithFilename | undefined;
}

export function StoryTypes(props: StoryTypesProps) {
  const query = '';
  const nodes = usePropTree(props.types?.props ?? {}, query);

  return (
    <Fragment>
      <h3>API Reference</h3>
      <p>{props.types?.description}</p>
      <StoryTableContainer>
        <StoryTypesTable>
          <StoryTypesTableHeader>
            <tr>
              <StoryTypesTableHeaderCell>Prop</StoryTypesTableHeaderCell>
              <StoryTypesTableHeaderCell>Description</StoryTypesTableHeaderCell>
            </tr>
          </StoryTypesTableHeader>
          <tbody>
            {nodes.length === 0 && !query ? (
              <tr>
                <StoryTypesTableCell colSpan={2}>
                  This story has no types. You are either running storybook without types
                  or the types you are attempting to pass to the story component are
                  falsey.
                </StoryTypesTableCell>
              </tr>
            ) : nodes.length === 0 && query ? (
              <tr>
                <StoryTypesTableCell colSpan={2}>No results found</StoryTypesTableCell>
              </tr>
            ) : null}
            {nodes.map(n => {
              if ('definitionFilePath' in n.prop) {
                return (
                  <StoryDefinitionFilePath key={n.prop.definitionFilePath} node={n} />
                );
              }

              // This shouldnt happen as all props should be nested under a definition node
              return (
                <tr key={n.prop.name}>
                  <StoryProps node={n} />
                </tr>
              );
            })}
          </tbody>
        </StoryTypesTable>
      </StoryTableContainer>
    </Fragment>
  );
}

function StoryDefinitionFilePath(props: {node: PropTreeNode}) {
  const [expanded, setExpanded] = useState(props.node.expanded);

  if (expanded !== props.node.expanded) {
    setExpanded(props.node.expanded);
  }

  if (!props.node.visible) {
    return null;
  }

  if (!('definitionFilePath' in props.node.prop)) {
    return null;
  }

  return (
    <Fragment>
      <tr>
        <StoryTypesTableCell colSpan={2}>
          {props.node.prop.parent?.name} (
          {stripNodeModulesPrefix(props.node.prop.definitionFilePath)})
        </StoryTypesTableCell>
      </tr>
      {expanded ? (
        <Fragment>
          {Object.values(props.node.children).map(n => (
            <tr key={'name' in n.prop ? n.prop.name : n.prop.definitionFilePath}>
              <StoryProps node={n} />
            </tr>
          ))}
        </Fragment>
      ) : null}
    </Fragment>
  );
}

function StoryProps(props: {node: PropTreeNode}) {
  if (!props.node.visible) {
    return null;
  }

  if ('definitionFilePath' in props.node.prop) {
    return null;
  }

  return (
    <Fragment>
      <StoryTypesTableCell>
        {props.node.prop.name}
        {props.node.prop.required ? (
          <Tooltip title="This is a required prop">
            <Required />
          </Tooltip>
        ) : null}
      </StoryTypesTableCell>
      <StoryTypesTableCell>
        {props.node.prop.description ? (
          <StoryPropDescription>{props.node.prop.description}</StoryPropDescription>
        ) : null}
        <StoryType>
          {props.node.prop.type.raw
            ? props.node.prop.type.raw
            : props.node.prop.type.name}
        </StoryType>
      </StoryTypesTableCell>
    </Fragment>
  );
}

class PropTreeNode {
  public visible = true;
  public expanded = true;
  public children: Record<string, PropTreeNode> = {};

  constructor(
    public prop: PropItem | {definitionFilePath: string; parent: PropItem['parent']}
  ) {
    this.prop = prop;
  }

  // preorder traversal
  *[Symbol.iterator]() {
    function* recurse(node: PropTreeNode): Generator<PropTreeNode> {
      yield node;

      for (const child of Object.values(node.children)) {
        yield* recurse(child);
      }
    }

    yield* recurse(this);
  }
}

function usePropTree(props: Props, query: string): PropTreeNode[] {
  const root = useMemo(() => {
    const r = new PropTreeNode({definitionFilePath: 'root', parent: undefined});
    const grouped = groupByParent(Object.values(props));

    for (const [definitionFilePath, groupedProp] of Object.entries(grouped)) {
      const parent = new PropTreeNode({
        definitionFilePath,
        parent: groupedProp[0]?.parent,
      });

      for (const prop of groupedProp) {
        const child = new PropTreeNode(prop);
        parent.children[prop.name] = child;
      }

      r.children[definitionFilePath] = parent;
    }

    return r;
  }, [props]);

  const nodes = useMemo(() => {
    if (!query) {
      for (const node of root) {
        node.visible = true;
        node.expanded = true;
      }
      return Object.values(root.children);
    }

    // Mark all as not matching
    for (const node of root) {
      node.visible = false;
      node.expanded = false;
    }

    // Fzf requires the input to be lowercase as it normalizes the search candidates to lowercase
    const lowerCaseQuery = query.toLowerCase();

    for (const node of root) {
      // index files are useless when trying to match by name, so we'll special
      // case them and match by their full path as it'll contain a more
      // relevant path that we can match against.
      const name = 'name' in node.prop ? node.prop.name : node.prop.definitionFilePath;
      const match = fzf(name, lowerCaseQuery, false);

      if (match.score > 0) {
        node.visible = true;

        if (Object.keys(node.children).length > 0) {
          node.expanded = true;
          for (const child of Object.values(node.children)) {
            child.visible = true;
          }
        }
      }
    }

    return Object.values(root.children);
  }, [root, query]);

  return nodes;
}

function sortRequiredOrByName(a: PropItem, b: PropItem): number {
  if (a.required && !b.required) {
    return -1;
  }
  if (!a.required && b.required) {
    return 1;
  }

  return a.name.localeCompare(b.name);
}

function groupByParent(props: PropItem[]) {
  return props.reduce(
    (acc, prop) => {
      acc[prop.parent?.fileName ?? ''] = (acc[prop.parent?.fileName ?? ''] ?? []).concat(
        prop
      );
      return acc;
    },
    {} as Record<string, PropItem[]>
  );
}

function stripNodeModulesPrefix(str: string): string {
  return str.split('/node_modules/')[1] ?? str;
}

const StoryTableContainer = styled('div')`
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const StoryTypesTable = styled('table')`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0;
  border-radius: ${p => p.theme.borderRadius};
  word-break: normal;

  th {
    background-color: ${p => p.theme.surface200};
  }

  tr:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }

  td:not(:last-child),
  th:not(:last-child) {
    border-right: 1px solid ${p => p.theme.border};
  }
`;

const StoryTypesTableHeader = styled('thead')`
  tr {
    background-color: ${p => p.theme.surface200};
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const StoryTypesTableHeaderCell = styled('th')`
  background-color: ${p => p.theme.surface200};
  padding: ${space(1)};
`;

const StoryTypesTableCell = styled('td')`
  padding: ${space(1)};
`;

const StoryType = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
`;

const StoryPropDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  margin-bottom: ${space(0.5)};
`;

function Required() {
  return <RequiredAsterisk>*</RequiredAsterisk>;
}

const RequiredAsterisk = styled('span')`
  color: ${p => p.theme.error};
`;
