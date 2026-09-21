import {Fragment, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Flex} from '@sentry/scraps/layout';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';
import {Text} from '@sentry/scraps/text';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import {
  TREE_VALUE_DROPDOWN_BUTTON_CLASS,
  TreeBranchIcon,
  TreeColumn as KeyValueTreeColumn,
  TreeContainer as KeyValueTreeContainer,
  TreeKey,
  TreeKeyTrunk,
  TreeRow,
  TreeSearchKey,
  TreeSpacer,
  TreeValue,
  TreeValueDropdown as KeyValueTreeValueDropdown,
  TreeValueTrunk as KeyValueTreeValueTrunk,
} from 'sentry/components/keyValueTree/styles';
import {distributeRowGroupsIntoColumns} from 'sentry/components/keyValueTree/utils';
import {IconEllipsis, IconPin} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {type RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {isValidUrl} from 'sentry/utils/string/isValidUrl';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';

import {AttributesTreeValue} from './attributesTreeValue';

const MAX_TREE_DEPTH = 4;
const INVALID_BRANCH_REGEX = /\.{2,}/;

interface Attribute {
  attribute_key: string;
  attribute_value: string | number | null;
  original_attribute_key: string;
  type: TraceItemResponseAttribute['type'];
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

interface AttributesTreeProps<
  RendererExtra extends RenderFunctionBaggage,
> extends AttributesFieldRender<RendererExtra> {
  /**
   * The attributes to show in the attribute tree. If you need to hide any attributes, filter them out before passing them here. If you need extra attribute information for rendering but you don't want to show those attributes, pass that information in the `rendererExtra` prop.
   */
  attributes: TraceItemResponseAttribute[];
  // If provided, locks the number of columns to this number. If not provided, the number of columns will be dynamic based on width.
  columnCount?: number;
  config?: AttributesTreeRowConfig;
  getAdjustedAttributeKey?: (attribute: TraceItemResponseAttribute) => string;
  getCustomActions?: (content: AttributesTreeContent) => MenuItemProps[];
  pinnedAttribute?: string | null;
}

interface AttributesTreeColumnsProps<
  RendererExtra extends RenderFunctionBaggage,
> extends AttributesTreeProps<RendererExtra> {
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

interface AttributesTreeRowProps<
  RendererExtra extends RenderFunctionBaggage,
> extends AttributesFieldRender<RendererExtra> {
  attributeKey: string;
  content: AttributesTreeContent;
  config?: AttributesTreeRowConfig;
  getCustomActions?: (content: AttributesTreeContent) => MenuItemProps[];
  isLast?: boolean;
  pinnedAttribute?: string | null;
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
  const pseudoAttribute: Attribute = {
    attribute_key: branch,
    attribute_value: attribute.attribute_value,
    original_attribute_key: attribute.original_attribute_key,
    type: attribute.type,
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
  pinnedAttribute,
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
        pinnedAttribute,
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
      pinnedAttribute={pinnedAttribute}
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
  pinnedAttribute,
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
        pinnedAttribute,
      })
    );

    return distributeRowGroupsIntoColumns(attributeTreeRowGroups, columnCount).map(
      (column, index) => (
        <TreeColumn key={index} data-test-id="attribute-tree-column">
          {column}
        </TreeColumn>
      )
    );
  }, [
    attributes,
    columnCount,
    renderers,
    renderExtra,
    config,
    getCustomActions,
    getAdjustedAttributeKey,
    pinnedAttribute,
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
  pinnedAttribute,
  ...props
}: AttributesTreeRowProps<RendererExtra>) {
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
    <RevealOnHover>
      {revealOnHoverProps => (
        <TreeRow hasErrors={hasErrors} {...props} {...revealOnHoverProps}>
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
              <Flex align="center" gap="xs">
                <Text>{attributeKey}</Text>
                {pinnedAttribute === originalAttribute.original_attribute_key && (
                  <IconPin size="xs" isSolid aria-label={t('Pinned attribute')} />
                )}
              </Flex>
            </TreeKey>
          </TreeKeyTrunk>
          <TreeValueTrunk>
            <TreeValue hasErrors={hasErrors}>
              <AttributesTreeValue
                config={config}
                content={content}
                renderers={props.renderers}
                rendererExtra={props.rendererExtra}
              />
            </TreeValue>
            {attributeActions}
          </TreeValueTrunk>
        </TreeRow>
      )}
    </RevealOnHover>
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
  if (isValidUrl(String(content.value))) {
    items.push({
      key: 'external-link',
      label: t('Visit this external link'),
      onAction: () => {
        openNavigateToExternalLinkModal({linkText: String(content.value)});
      },
    });
  }

  return (
    <RevealOnHover.Action visible={isMenuOpen}>
      <TreeValueDropdown
        preventOverflowOptions={{padding: 4}}
        position="bottom-end"
        size="xs"
        isOpen={isMenuOpen}
        onOpenChange={setIsMenuOpen}
        triggerProps={{
          'aria-label': t('Attribute Actions Menu'),
          icon: <IconEllipsis />,
          showChevron: false,
          className: TREE_VALUE_DROPDOWN_BUTTON_CLASS,
        }}
        items={items}
      />
    </RevealOnHover.Action>
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
    type: attribute.type,
  };
}

const TreeContainer = styled(KeyValueTreeContainer)`
  white-space: normal;
`;

const TreeColumn = styled(KeyValueTreeColumn)`
  grid-template-columns: minmax(min-content, max-content) auto;
`;

const TreeValueTrunk = styled(KeyValueTreeValueTrunk)`
  grid-template-columns: minmax(0, 1fr) auto;
`;

const TreeValueDropdown = styled(KeyValueTreeValueDropdown)`
  .${TREE_VALUE_DROPDOWN_BUTTON_CLASS} {
    z-index: 1;
  }
`;
