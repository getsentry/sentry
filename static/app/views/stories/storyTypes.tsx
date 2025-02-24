import {Fragment, useMemo, useState} from 'react';
import type {PropItem, Props} from 'react-docgen-typescript';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {InputGroup} from 'sentry/components/inputGroup';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron} from 'sentry/icons';
import {IconSearch} from 'sentry/icons/iconSearch';
import {StorySection, StoryTitle} from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';
import {fzf} from 'sentry/utils/profiling/fzf/fzf';

interface StoryTypesProps {
  types: TypeLoader.ComponentDocWithFilename | undefined;
}

export function StoryTypes(props: StoryTypesProps) {
  const [query, setQuery] = useState('');
  const nodes = usePropTree(props.types?.props ?? {}, query);

  return (
    <StorySection>
      <StoryTitle>API Reference</StoryTitle>
      <p>{props.types?.description}</p>
      <StoryTypesSearchContainer>
        <InputGroup>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSearch />
          </InputGroup.LeadingItems>
          <InputGroup.Input
            placeholder="Search props"
            defaultValue={query}
            onChange={e => setQuery(e.target.value)}
          />
          {/* @TODO (JonasBadalic): Implement clear button when there is an active query */}
        </InputGroup>
      </StoryTypesSearchContainer>
      <StoryTableContainer>
        <StoryTypesTable>
          <StoryTypesTableHeader>
            <tr>
              <StoryTypesTableHeaderCell>Prop</StoryTypesTableHeaderCell>
              <StoryTypesTableHeaderCell>Description</StoryTypesTableHeaderCell>
            </tr>
          </StoryTypesTableHeader>
          <tbody>
            {nodes.length === 0 ? (
              query ? (
                <tr>
                  <StoryTypesTableCell colSpan={2}>
                    Bummer, but nothing matches "{query}"
                  </StoryTypesTableCell>
                </tr>
              ) : (
                <tr>
                  <StoryTypesTableCell colSpan={2}>
                    This story has no types. You are either running storybook without
                    types or the types you are attempting to pass to the story component
                    are falsey.
                  </StoryTypesTableCell>
                </tr>
              )
            ) : null}
            {nodes.map(n => {
              if ('definitionFilePath' in n.prop) {
                if (!n.visible) {
                  return null;
                }

                return (
                  <StoryDefinitionFilePath key={n.prop.definitionFilePath} node={n} />
                );
              }

              // This shouldnt happen as all props should be nested under a definition node
              if (!n.expanded) {
                return null;
              }

              return (
                <tr key={n.prop.name}>
                  <StoryProps node={n} />
                </tr>
              );
            })}
          </tbody>
        </StoryTypesTable>
      </StoryTableContainer>
    </StorySection>
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
        <StoryTypesTableDefinitionCell colSpan={2}>
          <StoryTypesTableDefinitionCellContent>
            <Button
              borderless
              icon={<IconChevron direction={expanded ? 'down' : 'right'} />}
              onClick={() => {
                props.node.expanded = !expanded;
                setExpanded(props.node.expanded);
              }}
              size="xs"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            />{' '}
            <span>{props.node.prop.parent?.name}</span> (
            {stripNodeModulesPrefix(props.node.prop.definitionFilePath)})
          </StoryTypesTableDefinitionCellContent>
        </StoryTypesTableDefinitionCell>
      </tr>
      {expanded ? (
        <Fragment>
          {Object.values(props.node.children)
            .sort(propSort)
            .map(n => (
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
            <RequiredAsterisk>*</RequiredAsterisk>
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

  public prop: PropItem | {definitionFilePath: string; parent: PropItem['parent']};
  public result: ReturnType<typeof fzf> | null = null;

  constructor(prop: PropItem | {definitionFilePath: string; parent: PropItem['parent']}) {
    this.prop = prop;
  }

  // preorder traversal
  *[Symbol.iterator]() {
    function* recurse(
      node: PropTreeNode,
      path: PropTreeNode[]
    ): Generator<{node: PropTreeNode; path: PropTreeNode[]}> {
      yield {node, path};

      for (const child of Object.values(node.children)) {
        yield* recurse(child, path.concat(node));
      }
    }

    yield* recurse(this, []);
  }
}

function usePropTree(props: Props, query: string): PropTreeNode[] {
  const root = useMemo(() => {
    const r = new PropTreeNode({definitionFilePath: 'root', parent: undefined});
    const grouped = Object.groupBy(Object.values(props), p => p.parent?.fileName ?? '');

    for (const [definitionFilePath, groupedProp] of Object.entries(grouped)) {
      const parent = new PropTreeNode({
        definitionFilePath,
        parent: groupedProp?.[0]?.parent,
      });

      for (const prop of groupedProp ?? []) {
        const child = new PropTreeNode(prop);
        parent.children[prop.name] = child;
      }

      r.children[definitionFilePath] = parent;
    }

    return r;
  }, [props]);

  const nodes = useMemo(() => {
    if (!query) {
      for (const {node} of root) {
        node.visible = true;
        node.expanded = true;
        node.result = null;
      }

      // We only want the first definition to be expanded as that is the definition that lives inside
      // the component file. The rest of the definitions could be inherited from definitions in other files.
      // A typical example is interface Props extends HTMLProps<Element> where we only want to show the definition
      // of Props, but not the definition of HTMLProps<Element>. We thus collapse it so that the user can
      // still search for it or expand its definitions
      let expanded = true;
      for (const node of Object.values(root.children)) {
        node.visible = true;
        node.expanded = expanded;
        expanded = false;
      }

      return Object.values(root.children);
    }

    // Mark all as not matching
    for (const {node} of root) {
      node.visible = false;
      node.expanded = false;
      node.result = null;
    }

    // Fzf requires the input to be lowercase as it normalizes the search candidates to lowercase
    const lowerCaseQuery = query.toLowerCase();

    for (const {node, path} of root) {
      // index files are useless when trying to match by name, so we'll special
      // case them and match by their full path as it'll contain a more
      // relevant path that we can match against.
      const name = 'name' in node.prop ? node.prop.name : node.prop.definitionFilePath;
      const match = fzf(name, lowerCaseQuery, false);

      if (match.score > 0) {
        node.result = match;
        node.visible = true;

        if (Object.keys(node.children).length > 0) {
          node.expanded = true;
          for (const child of Object.values(node.children)) {
            child.visible = true;
          }
        }
        for (const p of path) {
          p.visible = true;
          p.expanded = true;
          // The entire path needs to contain max score of its child results so that
          // the entire path to it can be sorted by this score. The side effect of this is that results from the same
          // tree path with a lower score will be placed higher in the tree if that same path has a higher score anywhere
          // in the tree. This isn't ideal, but given that it favors the most relevant results, it makes it a good starting point.
          p.result = match.score > (p.result?.score ?? 0) ? match : p.result;
        }
      }
    }

    return Object.values(root.children);
  }, [root, query]);

  return nodes;
}

function propSort(a: PropTreeNode, b: PropTreeNode) {
  if (a.visible && !b.visible) {
    return -1;
  }

  if (!a.visible && b.visible) {
    return 1;
  }

  if (a.result || b.result) {
    if (a.result && b.result) {
      return b.result.score - a.result.score;
    }

    if (a.result) {
      return -1;
    }

    if (b.result) {
      return 1;
    }
  }

  if ('definitionFilePath' in a.prop && 'definitionFilePath' in b.prop) {
    return a.prop.definitionFilePath.localeCompare(b.prop.definitionFilePath);
  }

  if ('definitionFilePath' in a.prop) {
    return 0;
  }

  if ('definitionFilePath' in b.prop) {
    return 0;
  }

  if (!a.prop.required && b.prop.required) {
    return 1;
  }

  if (a.prop.required && !b.prop.required) {
    return -1;
  }

  return a.prop.name.localeCompare(b.prop.name);
}

function stripNodeModulesPrefix(str: string): string {
  return str.split('/node_modules/')[1] ?? str;
}

const StoryTableContainer = styled('div')`
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const StoryTypesSearchContainer = styled('div')`
  margin-bottom: ${space(1)};
`;

const StoryTypesTable = styled('table')`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0;
  border-radius: ${p => p.theme.borderRadius};
  word-break: normal;
  table-layout: fixed;

  th {
    background-color: ${p => p.theme.surface200};
  }

  tr:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }

  td:first-child {
    width: 20%;
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
  padding-left: ${space(1.5)};
`;

const StoryTypesTableDefinitionCell = styled('td')`
  padding: ${space(1)};
  padding-left: 0;
  background-color: ${p => p.theme.surface200};

  button {
    margin-left: ${space(0.25)};
    margin-right: ${space(0.25)};
  }

  > span {
    font-size: ${p => p.theme.fontSizeRelativeSmall};
    font-weight: ${p => p.theme.fontWeightBold};
    margin-right: ${space(0.5)};
  }
`;

const StoryTypesTableDefinitionCellContent = styled('div')`
  display: flex;
  align-items: center;
`;

const StoryType = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
`;

const StoryPropDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  margin-bottom: ${space(0.5)};
`;

const RequiredAsterisk = styled('span')`
  color: ${p => p.theme.error};
`;
