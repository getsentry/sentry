import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {isUrl} from 'sentry/utils/string/isUrl';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {
  useLogsFields,
  useLogsIsTableEditingFrozen,
  useLogsSearch,
  useSetLogsFields,
  useSetLogsSearch,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import type {TraceItemAttributes} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {
  LogAttributesRendererMap,
  RendererExtra,
} from 'sentry/views/explore/logs/fieldRenderers';
import {type OurLogFieldKey, OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {
  adjustLogTraceID,
  getLogAttributeItem,
  removeSentryPrefix,
} from 'sentry/views/explore/logs/utils';

const MAX_TREE_DEPTH = 4;
const INVALID_BRANCH_REGEX = /\.{2,}/;

interface Attribute {
  attribute_key: string;
  attribute_value: string | number | null;
  original_attribute_key: string;
}

interface AttributeTree {
  [key: string]: AttributeTreeContent;
}

interface AttributeTreeContent {
  subtree: AttributeTree;
  value: string | number | null;
  // These will be omitted on pseudo attributes (see addToAttributeTree)
  meta?: Record<any, any>;
  originalAttribute?: Attribute;
}

interface AttributeTreeColumnData {
  columns: React.ReactNode[];
  runningTotal: number;
  startIndex: number;
}

interface LogAttributeFieldRender {
  renderExtra: RendererExtra;
  renderers?: typeof LogAttributesRendererMap;
}

interface LogFieldsTreeProps extends LogAttributeFieldRender {
  attributes: TraceItemAttributes;
  hiddenAttributes?: OurLogFieldKey[];
}

interface LogFieldsTreeColumnsProps extends LogAttributeFieldRender {
  attributes: TraceItemAttributes;
  columnCount: number;
  hiddenAttributes?: OurLogFieldKey[];
}

interface LogFieldsTreeRowConfig {
  // Omits the dropdown of actions applicable to this attribute
  disableActions?: boolean;
  // Omit error styling from being displayed, even if context is invalid
  disableErrors?: boolean;
  // Displays attribute value as plain text, rather than a hyperlink if applicable
  disableRichValue?: boolean;
}

interface LogFieldsTreeRowProps extends LogAttributeFieldRender {
  attributeKey: string;
  content: AttributeTreeContent;
  config?: LogFieldsTreeRowConfig;
  isLast?: boolean;
  spacerCount?: number;
}

function addToAttributeTree(
  tree: AttributeTree,
  attribute: Attribute,
  meta: Record<any, any>,
  originalAttribute: Attribute
): AttributeTree {
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
      subtree: {},
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
 * @returns A list of LogFieldsTreeRow components to be rendered in this tree
 */
function getAttributeTreeRows({
  attributeKey,
  content,
  spacerCount = 0,
  uniqueKey,
  renderers = {},
  renderExtra,
  isLast = false,
}: LogFieldsTreeRowProps &
  LogAttributeFieldRender & {
    uniqueKey: string;
  }): React.ReactNode[] {
  const subtreeAttributes = Object.keys(content.subtree);
  const subtreeRows = subtreeAttributes.reduce(
    (rows: React.ReactNode[], attribute, i) => {
      const branchRows = getAttributeTreeRows({
        attributeKey: attribute,
        content: content.subtree[attribute]!,
        spacerCount: spacerCount + 1,
        isLast: i === subtreeAttributes.length - 1,
        uniqueKey: `${uniqueKey}-${i}`,
        renderers,
        renderExtra,
      });
      return rows.concat(branchRows);
    },
    []
  );
  return [
    <LogFieldsTreeRow
      key={`${attributeKey}-${spacerCount}-${uniqueKey}`}
      attributeKey={attributeKey}
      content={content}
      spacerCount={spacerCount}
      data-test-id="attribute-tree-row"
      renderers={renderers}
      renderExtra={renderExtra}
      isLast={isLast}
    />,
    ...subtreeRows,
  ];
}

/**
 * Component to render proportional columns for log fields. The columns will not separate
 * branch attributes from their roots, and attempt to be as evenly distributed as possible.
 */
function LogFieldsTreeColumns({
  attributes,
  columnCount,
  hiddenAttributes = [],
  renderers = {},
  renderExtra,
}: LogFieldsTreeColumnsProps) {
  const assembledColumns = useMemo(() => {
    if (!attributes) {
      return [];
    }

    // Convert attributes record to the format expected by addToAttributeTree
    const visibleAttributes = (
      Array.isArray(attributes) ? attributes : Object.keys(attributes)
    )
      .map(key => getAttribute(attributes, key, hiddenAttributes))
      .filter(defined);

    // Create the AttributeTree data structure using all the given attributes
    const attributeTree = visibleAttributes.reduce<AttributeTree>(
      (tree, attribute) => addToAttributeTree(tree, attribute, {}, attribute),
      {}
    );

    // Create a list of AttributeTreeRow lists, containing every row to be rendered. They are grouped by
    // root parent so that we do not split up roots/branches when forming columns
    const attributeTreeRowGroups: React.ReactNode[][] = Object.entries(attributeTree).map(
      ([attributeKey, content], i) =>
        getAttributeTreeRows({
          attributeKey,
          content,
          uniqueKey: `${i}`,
          renderers,
          renderExtra,
        })
    );

    // Get the total number of LogFieldsTreeRow components to be rendered, and a goal size for each column
    const attributeTreeRowTotal = attributeTreeRowGroups.reduce(
      (sum, group) => sum + group.length,
      0
    );
    const columnRowGoal = Math.ceil(attributeTreeRowTotal / columnCount);

    // Iterate through the row groups, splitting rows into columns when we exceed the goal size
    const data = attributeTreeRowGroups.reduce<AttributeTreeColumnData>(
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
  }, [attributes, columnCount, hiddenAttributes, renderers, renderExtra]);

  return <Fragment>{assembledColumns}</Fragment>;
}

export function LogFieldsTree(props: LogFieldsTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useIssueDetailsColumnCount(containerRef);
  return (
    <TreeContainer
      ref={containerRef}
      columnCount={columnCount}
      data-test-id="log-fields-tree"
    >
      <LogFieldsTreeColumns columnCount={columnCount} {...props} />
    </TreeContainer>
  );
}

function LogFieldsTreeRow({
  content,
  attributeKey,
  spacerCount = 0,
  isLast = false,
  config = {},
  ...props
}: LogFieldsTreeRowProps) {
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
    <LogFieldsTreeRowDropdown content={content} />
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
        <TreeKey hasErrors={hasErrors} title={originalAttribute.attribute_key}>
          {attributeKey}
        </TreeKey>
      </TreeKeyTrunk>
      <TreeValueTrunk>
        <TreeValue hasErrors={hasErrors}>
          <LogFieldsTreeValue
            config={config}
            content={content}
            renderers={props.renderers}
            renderExtra={props.renderExtra}
          />
        </TreeValue>
        {attributeActions}
      </TreeValueTrunk>
    </TreeRow>
  );
}

function LogFieldsTreeRowDropdown({content}: {content: AttributeTreeContent}) {
  const {onClick: handleCopy} = useCopyToClipboard({
    text: String(content.value),
  });
  const setLogsSearch = useSetLogsSearch();
  const search = useLogsSearch();
  const fields = useLogsFields();
  const setLogFields = useSetLogsFields();
  const isTableEditingFrozen = useLogsIsTableEditingFrozen();
  const [isVisible, setIsVisible] = useState(false);
  const originalAttribute = content.originalAttribute;
  const addSearchFilter = useCallback(
    ({negated}: {negated?: boolean} = {}) => {
      if (!originalAttribute) {
        return;
      }
      const newSearch = search.copy();
      newSearch.addFilterValue(
        `${negated ? '!' : ''}${originalAttribute.original_attribute_key}`,
        String(content.value)
      );
      setLogsSearch(newSearch);
    },
    [originalAttribute, content.value, setLogsSearch, search]
  );

  const addColumn = useCallback(() => {
    if (!originalAttribute) {
      return;
    }
    const newFields = [...fields];
    if (newFields[newFields.length - 1] === OurLogKnownFieldKey.TIMESTAMP) {
      newFields.splice(-1, 0, originalAttribute.original_attribute_key);
    } else {
      newFields.push(originalAttribute.original_attribute_key);
    }
    setLogFields(newFields);
  }, [originalAttribute, setLogFields, fields]);

  if (!originalAttribute) {
    return null;
  }

  const items: MenuItemProps[] = [
    {
      key: 'search-for-value',
      label: t('Search for this value'),
      onAction: () => {
        addSearchFilter();
      },
    },
    {
      key: 'search-for-negated-value',
      label: t('Exclude this value'),
      onAction: () => {
        addSearchFilter({negated: true});
      },
    },
    {
      key: 'add-column',
      label: t('Add this as table column'),
      hidden: isTableEditingFrozen,
      disabled: fields.includes(originalAttribute.original_attribute_key),
      onAction: () => {
        addColumn();
      },
    },
    {
      key: 'copy-value',
      label: t('Copy attribute value to clipboard'),
      onAction: handleCopy,
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

function LogFieldsTreeValue({
  config,
  content,
  renderers = {},
  renderExtra,
}: {
  content: AttributeTreeContent;
  config?: LogFieldsTreeRowConfig;
} & LogAttributeFieldRender) {
  const {originalAttribute} = content;
  if (!originalAttribute) {
    return null;
  }

  // Check if we have a custom renderer for this attribute
  const attributeKey = originalAttribute.original_attribute_key;
  const renderer = renderers[attributeKey];
  const basicRenderer = getFieldRenderer(attributeKey, {}, false);
  const adjustedValue =
    attributeKey === OurLogKnownFieldKey.TRACE_ID
      ? adjustLogTraceID(content.value as string)
      : content.value;

  const basicRendered = basicRenderer({[attributeKey]: adjustedValue}, renderExtra);
  const defaultValue = <span>{String(adjustedValue)}</span>;

  if (config?.disableRichValue) {
    return String(adjustedValue);
  }

  if (renderer) {
    return renderer({
      item: getLogAttributeItem(attributeKey, adjustedValue),
      extra: renderExtra,
      basicRendered,
    });
  }

  return isUrl(String(adjustedValue)) ? (
    <AttributeLinkText>
      <ExternalLink
        onClick={e => {
          e.preventDefault();
          openNavigateToExternalLinkModal({linkText: String(content.value)});
        }}
      >
        {basicRendered}
      </ExternalLink>
    </AttributeLinkText>
  ) : (
    defaultValue
  );
}

/**
 * Filters out hidden attributes, replaces sentry. prefixed keys, and simplifies the value
 */
function getAttribute(
  attributes: TraceItemAttributes,
  attributeKey: string | Record<string, any>,
  hiddenAttributes: OurLogFieldKey[]
): Attribute | undefined {
  if (typeof attributeKey === 'object') {
    return getAttributeFromObject(attributes, attributeKey, hiddenAttributes);
  }

  // Filter out hidden attributes
  if (hiddenAttributes.includes(attributeKey)) {
    return undefined;
  }

  const attribute = attributes[attributeKey];
  if (!attribute) {
    return undefined;
  }

  // Replace the key name with the new key name
  const newKeyName = removeSentryPrefix(attributeKey);

  const attributeValue =
    attribute.type === 'bool' ? String(attribute.value) : attribute.value;
  if (!defined(attributeValue)) {
    return undefined;
  }

  return {
    attribute_key: newKeyName,
    attribute_value: attributeValue,
    original_attribute_key: attributeKey,
  };
}

function getAttributeFromObject(
  _: TraceItemAttributes,
  attribute: Record<string, any>,
  hiddenAttributes: OurLogFieldKey[]
): Attribute | undefined {
  const attributeKey = attribute.name;
  // Filter out hidden attributes
  if (hiddenAttributes.includes(attributeKey)) {
    return undefined;
  }

  // Replace the key name with the new key name
  const newKeyName = removeSentryPrefix(attributeKey);

  const attributeValue =
    attribute.type === 'bool' ? String(attribute.value) : attribute.value;
  if (!defined(attributeValue)) {
    return undefined;
  }

  return {
    attribute_key: newKeyName,
    attribute_value: attributeValue,
    original_attribute_key: attributeKey,
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
  grid-template-columns: minmax(auto, 175px) 1fr;
  grid-column-gap: ${space(3)};
  &:first-child {
    margin-left: -${space(1)};
  }
  &:not(:first-child) {
    border-left: 1px solid ${p => p.theme.innerBorder};
    padding-left: ${space(2)};
    margin-left: -1px;
  }
  &:not(:last-child) {
    border-right: 1px solid ${p => p.theme.innerBorder};
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
      p.hasErrors ? p.theme.alert.error.backgroundLight : p.theme.backgroundSecondary};
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
  color: ${p => (p.hasErrors ? p.theme.alert.error.color : p.theme.subText)};
  background-color: ${p =>
    p.hasErrors ? p.theme.alert.error.backgroundLight : p.theme.background};
  box-shadow: inset 0 0 0 1px
    ${p => (p.hasErrors ? p.theme.alert.error.border : 'transparent')};
`;

const TreeSpacer = styled('div')<{hasStem: boolean; spacerCount: number}>`
  grid-column: span 1;
  /* Allows TreeBranchIcons to appear connected vertically */
  border-right: 1px solid ${p => (p.hasStem ? p.theme.border : 'transparent')};
  margin-right: -1px;
  height: 100%;
  width: ${p => (p.spacerCount - 1) * 20 + 3}px;
`;

const TreeBranchIcon = styled('div')<{hasErrors: boolean}>`
  border: 1px solid ${p => (p.hasErrors ? p.theme.alert.error.border : p.theme.border)};
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
  font-size: ${p => p.theme.fontSizeSmall};
  word-break: break-word;
  grid-column: span 1;
  color: ${p => (p.hasErrors ? 'inherit' : p.theme.textColor)};
`;

const TreeKey = styled(TreeValue)<{hasErrors?: boolean}>`
  color: ${p => (p.hasErrors ? 'inherit' : p.theme.subText)};
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

const AttributeLinkText = styled('span')`
  color: ${p => p.theme.linkColor};
  text-decoration: ${p => p.theme.linkUnderline} underline dotted;
  margin: 0;
  &:hover,
  &:focus {
    text-decoration: none;
  }
`;
