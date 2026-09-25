import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import {KeyValueTreeRow} from 'sentry/components/keyValueTree/keyValueTreeRow';
import {
  KeyValueTreeRowActions,
  visitExternalLinkAction,
} from 'sentry/components/keyValueTree/keyValueTreeRowActions';
import {
  TreeColumn as KeyValueTreeColumn,
  TreeContainer as KeyValueTreeContainer,
} from 'sentry/components/keyValueTree/styles';
import {
  buildKeyValueTree,
  getKeyValueTreeColumns,
  type KeyValueTreeContent,
  type KeyValueTreeRowConfig,
} from 'sentry/components/keyValueTree/utils';
import {IconPin} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {type RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';

import {AttributesTreeValue} from './attributesTreeValue';

interface Attribute {
  attribute_key: string;
  attribute_value: string | number | null;
  original_attribute_key: string;
  type: TraceItemResponseAttribute['type'];
}

export type AttributesTreeContent = KeyValueTreeContent<
  Attribute['attribute_value'],
  Attribute
>;

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
  config?: KeyValueTreeRowConfig;
  getAdjustedAttributeKey?: (attribute: TraceItemResponseAttribute) => string;
  getCustomActions?: (content: AttributesTreeContent) => MenuItemProps[];
  pinnedAttribute?: string | null;
}

interface AttributesTreeColumnsProps<
  RendererExtra extends RenderFunctionBaggage,
> extends AttributesTreeProps<RendererExtra> {
  columnCount: number;
}

interface AttributesTreeRowProps<
  RendererExtra extends RenderFunctionBaggage,
> extends AttributesFieldRender<RendererExtra> {
  attributeKey: string;
  content: AttributesTreeContent;
  config?: KeyValueTreeRowConfig;
  getCustomActions?: (content: AttributesTreeContent) => MenuItemProps[];
  hasStem?: boolean;
  pinnedAttribute?: string | null;
  spacerCount?: number;
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

    const attributesTree = buildKeyValueTree(
      attributes.flatMap(attribute => {
        const shaped = getAttribute(attribute, getAdjustedAttributeKey);
        return shaped
          ? [{key: shaped.attribute_key, value: shaped.attribute_value, original: shaped}]
          : [];
      })
    );

    return getKeyValueTreeColumns(attributesTree, columnCount).map((rows, index) => (
      <TreeColumn key={index} data-test-id="attribute-tree-column">
        {rows.map(row => (
          <AttributesTreeRow
            key={row.uniqueKey}
            attributeKey={row.treeKey}
            content={row.content}
            spacerCount={row.spacerCount}
            hasStem={row.hasStem}
            data-test-id="attribute-tree-row"
            renderers={renderers}
            rendererExtra={renderExtra}
            config={config}
            getCustomActions={getCustomActions}
            pinnedAttribute={pinnedAttribute}
          />
        ))}
      </TreeColumn>
    ));
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
  hasStem = false,
  config = {},
  getCustomActions,
  pinnedAttribute,
  renderers,
  rendererExtra,
  ...props
}: AttributesTreeRowProps<RendererExtra>) {
  const originalAttribute = content.original;

  if (!originalAttribute) {
    return (
      <KeyValueTreeRow
        {...props}
        hasStem={hasStem}
        label={attributeKey}
        spacerCount={spacerCount}
      />
    );
  }

  return (
    <KeyValueTreeRow
      {...props}
      actions={
        config?.disableActions ? undefined : (
          <AttributesTreeRowDropdown
            content={content}
            getCustomActions={getCustomActions}
          />
        )
      }
      hasStem={hasStem}
      fullKey={originalAttribute.attribute_key}
      label={
        <Flex
          align="center"
          gap="xs"
          data-test-id={`tree-key-${originalAttribute.original_attribute_key}`}
        >
          <Text>{attributeKey}</Text>
          {pinnedAttribute === originalAttribute.original_attribute_key && (
            <IconPin size="xs" isSolid aria-label={t('Pinned attribute')} />
          )}
        </Flex>
      }
      spacerCount={spacerCount}
      value={
        <AttributesTreeValue
          config={config}
          content={content}
          renderers={renderers}
          rendererExtra={rendererExtra}
        />
      }
    />
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
    visitExternalLinkAction(content.value),
  ];

  return <KeyValueTreeRowActions ariaLabel={t('Attribute Actions Menu')} items={items} />;
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
