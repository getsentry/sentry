import {Fragment, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {type RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {isUrl} from 'sentry/utils/string/isUrl';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';

import {AttributesTreeValue} from './attributesTreeValue';

const MAX_TREE_DEPTH = 4;
const INVALID_BRANCH_REGEX = /\.{2,}/;

interface Attribute {
  attribute_key: string;
  attribute_value: string | number | null;
  original_attribute_key: string;
}

type AttributesTree = Record<string, AttributesTreeContent>;

export interface AttributesTreeContent {
  subtree: AttributesTree;
  value: string | number | null;
  config?: AttributesTreeRowConfig;
  // These will be omitted on pseudo attributes (see addToAttributeTree)
  meta?: Record<any, any>;
  originalAttribute?: Attribute;
}

interface AttributesTreeColumnData {
  columns: React.ReactNode[];
  runningTotal: number;
  startIndex: number;
}

type AttributeItem = {
  fieldKey: string;
  value: string | number | null;
};

export type AttributesFieldRendererProps<RendererExtra extends RenderFunctionBaggage> = {
  extra: RendererExtra;
  item: AttributeItem;
  basicRendered?: React.ReactNode;
  meta?: EventsMetaType;
};

export interface AttributesFieldRender<RendererExtra extends RenderFunctionBaggage> {
  /**
   * Extra data that gets passed to the renderer function for every attribute in the tree. If any of your field renderers rely on data that isn't related to the attributes (e.g., the current theme or location) or data that lives in another attribute (e.g., using the log level attribute to render the log text attribute) you should pass that data as here.
   */
  rendererExtra: RendererExtra;
  renderers?: Record<
    string,
    (props: AttributesFieldRendererProps<RendererExtra>) => React.ReactNode
  >;
}

interface AttributesTreeProps<RendererExtra extends RenderFunctionBaggage>
  extends AttributesFieldRender<RendererExtra> {
  /**
   * The attributes to show in the attribute tree. If you need to hide any attributes, filter them out before passing them here. If you need extra attribute information for rendering but you don't want to show those attributes, pass that information in the `rendererExtra` prop.
   */
  attributes: TraceItemResponseAttribute[];
  // If provided, locks the number of columns to this number. If not provided, the number of columns will be dynamic based on width.
  columnCount?: number;
  config?: AttributesTreeRowConfig;
  getAdjustedAttributeKey?: (attribute: TraceItemResponseAttribute) => string;
  getCustomActions?: (content: AttributesTreeContent) => MenuItemProps[];
}

interface AttributesTreeColumnsProps<RendererExtra extends RenderFunctionBaggage>
  extends AttributesTreeProps<RendererExtra> {
  columnCount: number;
}

export interface AttributesTreeRowConfig {
  // Omits the dropdown of actions applicable to this attribute
  disableActions?: boolean;
  // Omit error styling from being displayed, even if context is invalid
  disableErrors?: boolean;
  // Displays attribute value as plain text, rather than a hyperlink if applicable
  disableRichValue?: boolean;
}

interface AttributesTreeRowProps<RendererExtra extends RenderFunctionBaggage>
  extends AttributesFieldRender<RendererExtra> {
  attributeKey: string;
  content: AttributesTreeContent;
  config?: AttributesTreeRowConfig;
  getCustomActions?: (content: AttributesTreeContent) => MenuItemProps[];
  isLast?: boolean;
  spacerCount?: number;
}

function addToAttributeTree(
  tree: AttributesTree,
  attribute: Attribute,
  meta: Record<any, any>,
  originalAttribute: Attribute
): AttributesTree {
  const BRANCH_MATCHES_REGEX = /\./g;
  if (!defined(attribute.attribute_key)) {
    return tree;
  }

  const branchMatches = attribute.attribute_key.match(BRANCH_MATCHES_REGEX) ?? [];

  const hasInvalidBranchCount =
    branchMatches.length <= 0 || branchMatches.length > MAX_TREE_DEPTH;
  const hasInvalidBranchSequence = INVALID_BRANCH_REGEX.test(attribute.attribute_key);

  // Ignore attributes with 0, or >4 branches, as well as sequential dots (e.g. 'some..attribute')
  if (hasInvalidBranchCount || hasInvalidBranchSequence) {
    tree[attribute.attribute_key] = {
      value: attribute.attribute_value,
      subtree: tree[attribute.attribute_key]?.subtree ?? {},
      meta,
      originalAttribute,
    };
    return tree;
  }
  // E.g. 'device.model.version'
  const splitIndex = attribute.attribute_key.indexOf('.'); // 6
  const trunk = attribute.attribute_key.slice(0, splitIndex); // 'device'
  const branch = attribute.attribute_key.slice(splitIndex + 1); // 'model.version'

  if (tree[trunk] === undefined) {
    tree[trunk] = {value: '', subtree: {}};
  }
  // Recurse with a pseudo attribute, e.g. 'model', to create nesting structure
  const pseudoAttribute = {
    attribute_key: branch,
    attribute_value: attribute.attribute_value,
    original_attribute_key: attribute.original_attribute_key,
  };
  tree[trunk].subtree = addToAttributeTree(
    tree[trunk].subtree,
    pseudoAttribute,
    meta,
    originalAttribute
  );
  return tree;
}

/**
 * Function to recursively create a flat list of all rows to be rendered for a given AttributeTree
 * @param props The props for rendering the root of the AttributeTree
 * @returns A list of TreeRow components to be rendered in this tree
 */
function getAttributesTreeRows<RendererExtra extends RenderFunctionBaggage>({
  attributeKey,
  content,
  spacerCount = 0,
  uniqueKey,
  renderers = {},
  rendererExtra,
  isLast = false,
  config = {},
  getCustomActions,
}: AttributesTreeRowProps<RendererExtra> &
  AttributesFieldRender<RendererExtra> & {
    uniqueKey: string;
  }): React.ReactNode[] {
  const subtreeAttributes = Object.keys(content.subtree);
  const subtreeRows = subtreeAttributes.reduce(
    (rows: React.ReactNode[], attribute, i) => {
      const branchRows = getAttributesTreeRows<RendererExtra>({
        attributeKey: attribute,
        content: content.subtree[attribute]!,
        spacerCount: spacerCount + 1,
        isLast: i === subtreeAttributes.length - 1,
        uniqueKey: `${uniqueKey}-${i}`,
        renderers,
        config,
        rendererExtra,
        getCustomActions,
      });
      return rows.concat(branchRows);
    },
    []
  );
  return [
    <AttributesTreeRow
      key={`${attributeKey}-${spacerCount}-${uniqueKey}`}
      attributeKey={attributeKey}
      content={content}
      spacerCount={spacerCount}
      data-test-id="attribute-tree-row"
      renderers={renderers}
      rendererExtra={rendererExtra}
      isLast={isLast}
      config={config}
      getCustomActions={getCustomActions}
    />,
    ...subtreeRows,
  ];
}

/**
 * Component to render proportional columns for attributes. The columns will not separate
 * branch attributes from their roots, and attempt to be as evenly distributed as possible.
 */
function AttributesTreeColumns<RendererExtra extends RenderFunctionBaggage>({
  attributes,
  columnCount,
  renderers = {},
  rendererExtra: renderExtra,
  config = {},
  getCustomActions,
  getAdjustedAttributeKey,
}: AttributesTreeColumnsProps<RendererExtra>) {
  const assembledColumns = useMemo(() => {
    if (!attributes) {
      return [];
    }

    // Convert attributes record to the format expected by addToAttributeTree
    const visibleAttributes = attributes
      .map(key => getAttribute(key, getAdjustedAttributeKey))
      .filter(defined);

    // Create the AttributeTree data structure using all the given attributes
    const attributesTree = visibleAttributes.reduce<AttributesTree>(
      (tree, attribute) => addToAttributeTree(tree, attribute, {}, attribute),
      {}
    );

    // Create a list of AttributeTreeRow lists, containing every row to be rendered. They are grouped by
    // root parent so that we do not split up roots/branches when forming columns
    const attributeTreeRowGroups: React.ReactNode[][] = Object.entries(
      attributesTree
    ).map(([attributeKey, content], i) =>
      getAttributesTreeRows({
        attributeKey,
        content,
        uniqueKey: `${i}`,
        renderers,
        rendererExtra: renderExtra,
        config,
        getCustomActions,
      })
    );

    // Get the total number of TreeRow components to be rendered, and a goal size for each column
    const attributeTreeRowTotal = attributeTreeRowGroups.reduce(
      (sum, group) => sum + group.length,
      0
    );
    const columnRowGoal = Math.ceil(attributeTreeRowTotal / columnCount);

    // Iterate through the row groups, splitting rows into columns when we exceed the goal size
    const data = attributeTreeRowGroups.reduce<AttributesTreeColumnData>(
      ({startIndex, runningTotal, columns}, rowList, index) => {
        // If it's the last entry, create a column with the remaining rows
        if (index === attributeTreeRowGroups.length - 1) {
          columns.push(
            <TreeColumn key={columns.length} data-test-id="attribute-tree-column">
              {attributeTreeRowGroups.slice(startIndex)}
            </TreeColumn>
          );
          return {startIndex, runningTotal, columns};
        }
        // If we reach the goal column size, wrap rows in a TreeColumn.
        if (runningTotal >= columnRowGoal) {
          columns.push(
            <TreeColumn key={columns.length} data-test-id="attribute-tree-column">
              {attributeTreeRowGroups.slice(startIndex, index)}
            </TreeColumn>
          );
          runningTotal = 0;
          startIndex = index;
        }
        runningTotal += rowList.length;
        return {startIndex, runningTotal, columns};
      },
      {startIndex: 0, runningTotal: 0, columns: []}
    );
    return data.columns;
  }, [
    attributes,
    columnCount,
    renderers,
    renderExtra,
    config,
    getCustomActions,
    getAdjustedAttributeKey,
  ]);

  return <Fragment>{assembledColumns}</Fragment>;
}

export function AttributesTree<RendererExtra extends RenderFunctionBaggage>(
  props: AttributesTreeProps<RendererExtra>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widthBasedColumnCount = useIssueDetailsColumnCount(containerRef);
  const columnCount = props.columnCount ?? widthBasedColumnCount;
  return (
    <TreeContainer
      ref={containerRef}
      columnCount={columnCount}
      data-test-id="fields-tree"
    >
      <AttributesTreeColumns {...props} columnCount={columnCount} />
    </TreeContainer>
  );
}

function AttributesTreeRow<RendererExtra extends RenderFunctionBaggage>({
  content,
  attributeKey,
  spacerCount = 0,
  isLast = false,
  config = {},
  getCustomActions,
  ...props
}: AttributesTreeRowProps<RendererExtra>) {
  const theme = useTheme();
  const originalAttribute = content.originalAttribute;
  const hasErrors = false; // No error handling in this simplified version
  const hasStem = !isLast && isEmptyObject(content.subtree);

  if (!originalAttribute) {
    return (
      <TreeRow hasErrors={hasErrors} {...props}>
        <TreeKeyTrunk spacerCount={spacerCount}>
          {spacerCount > 0 && (
            <Fragment>
              <TreeSpacer spacerCount={spacerCount} hasStem={hasStem} />
              <TreeBranchIcon hasErrors={hasErrors} />
            </Fragment>
          )}
          <TreeKey hasErrors={hasErrors}>{attributeKey}</TreeKey>
        </TreeKeyTrunk>
        <TreeValueTrunk />
      </TreeRow>
    );
  }

  const attributeActions = config?.disableActions ? null : (
    <AttributesTreeRowDropdown content={content} getCustomActions={getCustomActions} />
  );

  return (
    <TreeRow hasErrors={hasErrors} {...props}>
      <TreeKeyTrunk spacerCount={spacerCount}>
        {spacerCount > 0 && (
          <Fragment>
            <TreeSpacer spacerCount={spacerCount} hasStem={hasStem} />
            <TreeBranchIcon hasErrors={hasErrors} />
          </Fragment>
        )}
        <TreeSearchKey aria-hidden>{originalAttribute.attribute_key}</TreeSearchKey>
        <TreeKey
          hasErrors={hasErrors}
          title={originalAttribute.attribute_key}
          data-test-id={`tree-key-${content.originalAttribute?.original_attribute_key}`}
        >
          {attributeKey}
        </TreeKey>
      </TreeKeyTrunk>
      <TreeValueTrunk>
        <TreeValue hasErrors={hasErrors}>
          <AttributesTreeValue
            config={config}
            content={content}
            renderers={props.renderers}
            rendererExtra={props.rendererExtra}
            theme={theme}
          />
        </TreeValue>
        {attributeActions}
      </TreeValueTrunk>
    </TreeRow>
  );
}

function AttributesTreeRowDropdown({
  content,
  getCustomActions,
}: {
  content: AttributesTreeContent;
  getCustomActions?: (content: AttributesTreeContent) => MenuItemProps[];
}) {
  const {copy} = useCopyToClipboard();
  const [isVisible, setIsVisible] = useState(false);

  let customActions: MenuItemProps[] = [];
  if (getCustomActions) {
    customActions = getCustomActions(content);
  }

  const items: MenuItemProps[] = [
    ...customActions,
    {
      key: 'copy-value',
      label: t('Copy attribute value to clipboard'),
      onAction: () =>
        copy(String(content.value), {
          successMessage: t('Attribute value copied to clipboard'),
        }),
    },
  ];

  // Add external link option if the value is a URL
  if (isUrl(String(content.value))) {
    items.push({
      key: 'external-link',
      label: t('Visit this external link'),
      onAction: () => {
        openNavigateToExternalLinkModal({linkText: String(content.value)});
      },
    });
  }

  return (
    <TreeValueDropdown
      preventOverflowOptions={{padding: 4}}
      className={isVisible ? '' : 'invisible'}
      position="bottom-end"
      size="xs"
      onOpenChange={isOpen => setIsVisible(isOpen)}
      triggerProps={{
        'aria-label': t('Attribute Actions Menu'),
        icon: <IconEllipsis />,
        showChevron: false,
        className: 'attribute-button',
      }}
      items={items}
    />
  );
}

/**
 * Replaces sentry. prefixed keys, and simplifies the value
 */
function getAttribute(
  attribute: TraceItemResponseAttribute,
  getAdjustedAttributeKey?: (attribute: TraceItemResponseAttribute) => string
): Attribute | undefined {
  const attributeValue =
    attribute.type === 'bool' ? String(attribute.value) : attribute.value;

  if (!defined(attributeValue)) {
    return undefined;
  }

  return {
    attribute_key: prettifyAttributeName(attribute.name),
    attribute_value: attributeValue,
    original_attribute_key: getAdjustedAttributeKey
      ? getAdjustedAttributeKey(attribute)
      : attribute.name,
  };
}

const TreeContainer = styled('div')<{columnCount: number}>`
  display: grid;
  grid-template-columns: repeat(${p => p.columnCount}, 1fr);
  align-items: start;
  white-space: normal;
`;

const TreeColumn = styled('div')`
  display: grid;
  grid-template-columns: minmax(min-content, max-content) auto;
  grid-column-gap: ${space(3)};
  &:first-child {
    margin-left: -${space(1)};
  }
  &:not(:first-child) {
    border-left: 1px solid ${p => p.theme.tokens.border.secondary};
    padding-left: ${space(2)};
    margin-left: -1px;
  }
  &:not(:last-child) {
    border-right: 1px solid ${p => p.theme.tokens.border.secondary};
    padding-right: ${space(2)};
  }
`;

const TreeRow = styled('div')<{hasErrors: boolean}>`
  border-radius: ${space(0.5)};
  padding-left: ${space(1)};
  position: relative;
  display: grid;
  align-items: center;
  grid-column: span 2;
  column-gap: ${space(1.5)};
  grid-template-columns: subgrid;
  :nth-child(odd) {
    background-color: ${p =>
      p.hasErrors
        ? p.theme.alert.danger.backgroundLight
        : p.theme.tokens.background.secondary};
  }
  .invisible {
    visibility: hidden;
  }
  &:hover,
  &:active {
    .invisible {
      visibility: visible;
    }
  }
  color: ${p =>
    p.hasErrors ? p.theme.alert.danger.color : p.theme.tokens.content.secondary};
  background-color: ${p =>
    p.hasErrors
      ? p.theme.alert.danger.backgroundLight
      : p.theme.tokens.background.primary};
  box-shadow: inset 0 0 0 1px
    ${p => (p.hasErrors ? p.theme.alert.danger.border : 'transparent')};
`;

const TreeSpacer = styled('div')<{hasStem: boolean; spacerCount: number}>`
  grid-column: span 1;
  /* Allows TreeBranchIcons to appear connected vertically */
  border-right: 1px solid
    ${p => (p.hasStem ? p.theme.tokens.border.primary : 'transparent')};
  margin-right: -1px;
  height: 100%;
  width: ${p => (p.spacerCount - 1) * 20 + 3}px;
`;

const TreeBranchIcon = styled('div')<{hasErrors: boolean}>`
  border: 1px solid
    ${p => (p.hasErrors ? p.theme.alert.danger.border : p.theme.tokens.border.primary)};
  border-width: 0 0 1px 1px;
  border-radius: 0 0 0 5px;
  grid-column: span 1;
  height: 12px;
  align-self: start;
  margin-right: ${space(0.5)};
`;

const TreeKeyTrunk = styled('div')<{spacerCount: number}>`
  grid-column: 1 / 2;
  display: grid;
  height: 100%;
  align-items: center;
  grid-template-columns: ${p => (p.spacerCount > 0 ? `auto 1rem 1fr` : '1fr')};
`;

const TreeValueTrunk = styled('div')`
  grid-column: 2 / 3;
  display: grid;
  height: 100%;
  align-items: center;
  min-height: 22px;
  grid-template-columns: 1fr auto;
  grid-column-gap: ${space(0.5)};
`;

const TreeValue = styled('div')<{hasErrors?: boolean}>`
  padding: ${space(0.25)} 0;
  align-self: start;
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  word-break: break-word;
  grid-column: span 1;
  color: ${p => (p.hasErrors ? 'inherit' : p.theme.tokens.content.primary)};
`;

const TreeKey = styled(TreeValue)<{hasErrors?: boolean}>`
  color: ${p => (p.hasErrors ? 'inherit' : p.theme.tokens.content.secondary)};
`;

/**
 * Hidden element to allow browser searching for exact key name
 */
const TreeSearchKey = styled('span')`
  font-size: 0;
  position: absolute;
`;

const TreeValueDropdown = styled(DropdownMenu)`
  display: block;
  margin: 1px;
  height: 20px;
  .attribute-button {
    height: 20px;
    min-height: 20px;
    padding: 0 ${space(0.75)};
    border-radius: ${space(0.5)};
    z-index: 0;
  }
`;
