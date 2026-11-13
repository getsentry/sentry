import {useState} from 'react';
import {IconArrow} from '@sentry/icons/arrow';

import {Alert} from '@sentry/scraps/alert';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {isRecord} from 'sentry/utils/object/isRecord';
import type {
  DebuggerItemType,
  DebuggerJsonValue,
  WorkflowEngineDebuggerResponse,
} from 'sentry/utils/workflowEngineDebuggerApiOptions';

import {
  DiagnosticJson,
  propertyLabel,
  PropertyTable,
} from 'admin/components/workflowEngine/diagnosticData';

type JsonRecord = Record<string, DebuggerJsonValue>;
type EntityModel =
  | 'Action'
  | 'Condition'
  | 'Condition Group'
  | 'Data Source'
  | 'Detector'
  | 'Event'
  | 'Group'
  | 'Workflow';
type RelationshipDefinition = {
  key: string;
  label: string;
  model: EntityModel;
  conditionGroup?: boolean;
  many?: boolean;
  summaryOnly?: boolean;
};
type Entity = {
  fields: JsonRecord;
  key: string;
  model: EntityModel;
  relationships: Relationship[];
  summary: string;
  summaryOnly: boolean;
  title: string;
};
type Relationship = {
  key: string;
  label: string;
  nodes: Entity[];
  unavailable: string;
};

const CONDITION_RELATIONSHIPS: RelationshipDefinition[] = [
  {key: 'conditions', label: 'Conditions', model: 'Condition', many: true},
  {key: 'actions', label: 'Attached actions', model: 'Action', many: true},
];
const RELATED_DETECTORS: RelationshipDefinition = {
  key: 'detectors',
  label: 'Linked detectors',
  model: 'Detector',
  many: true,
  summaryOnly: true,
};
const RELATED_WORKFLOWS: RelationshipDefinition = {
  key: 'workflows',
  label: 'Linked workflows',
  model: 'Workflow',
  many: true,
  summaryOnly: true,
};
const RELATIONSHIPS: Record<DebuggerItemType, RelationshipDefinition[]> = {
  workflow: [
    {
      key: 'triggers',
      label: 'WHEN · trigger group',
      model: 'Condition Group',
      conditionGroup: true,
    },
    {
      key: 'actionFilters',
      label: 'IF · action filter groups',
      model: 'Condition Group',
      conditionGroup: true,
      many: true,
    },
    RELATED_DETECTORS,
  ],
  detector: [
    {
      key: 'conditionGroup',
      label: 'Trigger group',
      model: 'Condition Group',
      conditionGroup: true,
    },
    RELATED_WORKFLOWS,
    {
      key: 'dataSources',
      label: 'Data sources',
      model: 'Data Source',
      many: true,
      summaryOnly: true,
    },
    {
      key: 'latestGroups',
      label: 'Latest groups',
      model: 'Group',
      many: true,
      summaryOnly: true,
    },
  ],
  group: [RELATED_DETECTORS, RELATED_WORKFLOWS],
  event: [
    {key: 'group', label: 'Belongs to group', model: 'Group', summaryOnly: true},
    RELATED_DETECTORS,
    RELATED_WORKFLOWS,
  ],
};
const ITEM_LABELS: Record<DebuggerItemType, EntityModel> = {
  detector: 'Detector',
  workflow: 'Workflow',
  group: 'Group',
  event: 'Event',
};
const ENTITY_ACCENTS: Record<EntityModel, 'accent' | 'promotion' | 'secondary'> = {
  Action: 'promotion',
  Condition: 'accent',
  'Condition Group': 'accent',
  'Data Source': 'secondary',
  Detector: 'accent',
  Event: 'secondary',
  Group: 'secondary',
  Workflow: 'promotion',
};

function entitySummary(fields: JsonRecord): string {
  const parts: string[] = [];
  for (const key of ['type', 'logicType']) {
    const value = fields[key];
    if (typeof value === 'string' || typeof value === 'number') {
      parts.push(`${propertyLabel(key)}: ${value}`);
    }
  }
  if (typeof fields.enabled === 'boolean') {
    parts.push(fields.enabled ? 'Enabled' : 'Disabled');
  }
  if (typeof fields.status === 'string' || typeof fields.status === 'number') {
    parts.push(`Status: ${fields.status}`);
  }
  return parts.join(' · ');
}

function unavailableMessage(value: DebuggerJsonValue | undefined): string {
  if (value === undefined) {
    return 'Not returned in this response.';
  }
  if (value === null) {
    return 'Not configured (null).';
  }
  if (Array.isArray(value) && value.length === 0) {
    return 'No related records returned.';
  }
  return 'Inspect the source fields for the returned value.';
}

function buildEntity(
  key: string,
  model: EntityModel,
  data: JsonRecord,
  definitions: RelationshipDefinition[],
  summaryOnly = false
): Entity {
  const fields = {...data};
  const id =
    typeof data.id === 'string' || typeof data.id === 'number' ? ` ${data.id}` : '';
  const name = data.name ?? data.title;
  const title = `${model}${id}${typeof name === 'string' && name ? `: ${name}` : ''}`;
  const relationships = definitions.map(definition => {
    const value = data[definition.key];
    const records = definition.many
      ? Array.isArray(value)
        ? value.filter((record): record is JsonRecord => isRecord(record))
        : []
      : isRecord(value)
        ? [value]
        : [];

    // Keep unexpected relationship values in the entity's fields, rather than
    // turning them into invented entities or silently discarding them.
    if (
      definition.many
        ? Array.isArray(value) && records.length === value.length
        : isRecord(value)
    ) {
      delete fields[definition.key];
    }
    return {
      key: definition.key,
      label: definition.label,
      nodes: records.map((record, index) =>
        buildEntity(
          `${key}.${definition.key}.${index}`,
          definition.model,
          record,
          definition.conditionGroup ? CONDITION_RELATIONSHIPS : [],
          definition.summaryOnly
        )
      ),
      unavailable: unavailableMessage(value),
    };
  });
  return {
    key,
    model,
    title,
    fields,
    relationships,
    summary: entitySummary(data),
    summaryOnly,
  };
}

function EntityFields({fields}: {fields: JsonRecord}) {
  const properties: JsonRecord = {};
  const structured: Array<[string, DebuggerJsonValue]> = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null && typeof value === 'object') {
      structured.push([key, value]);
    } else {
      properties[key] = value;
    }
  }
  return (
    <Stack gap="lg" minWidth="0">
      <PropertyTable data={properties} caption="Properties" />
      {structured.map(([key, value]) => (
        <Stack
          as="section"
          aria-label={propertyLabel(key)}
          key={key}
          gap="sm"
          minWidth="0"
          borderTop="muted"
          paddingTop="md"
        >
          <Heading as="h4" size="sm">
            {propertyLabel(key)}
          </Heading>
          <DiagnosticJson value={value} />
        </Stack>
      ))}
    </Stack>
  );
}

function EntityNode({entity}: {entity: Entity}) {
  const [expanded, setExpanded] = useState(false);
  const accent = ENTITY_ACCENTS[entity.model];

  return (
    <Stack gap="md" minWidth="0">
      <Disclosure
        expanded={expanded}
        onExpandedChange={setExpanded}
        size="sm"
        gap="sm"
        padding="md"
        border="primary"
        borderLeft={accent === 'secondary' ? 'primary' : accent}
        radius="md"
        background="primary"
        width="100%"
        minWidth="0"
      >
        <Disclosure.Title aria-label={entity.title}>
          <Text
            size="md"
            variant={accent}
            bold
            wrap="normal"
            wordBreak="break-word"
            align="left"
          >
            {entity.title}
          </Text>
        </Disclosure.Title>
        {entity.summary && (
          <Container padding="0 xs">
            <Text size="md">{entity.summary}</Text>
          </Container>
        )}
        <Disclosure.Content role="region">
          {expanded && (
            <Stack gap="lg" borderTop="muted" paddingTop="md" minWidth="0">
              {entity.summaryOnly && (
                <Text size="md" variant="muted">
                  Related record summary. Only fields returned in this response are shown.
                </Text>
              )}
              <EntityFields fields={entity.fields} />
            </Stack>
          )}
        </Disclosure.Content>
      </Disclosure>
      {entity.relationships.length > 0 && (
        <Stack gap="lg" borderLeft="primary" paddingLeft="md" minWidth="0">
          {entity.relationships.map(relationship => (
            <Stack key={relationship.key} gap="md" minWidth="0">
              <Flex align="center" gap="sm">
                <Container borderTop="primary" width="16px" flexShrink={0} />
                <IconArrow direction="right" size="xs" />
                <Text size="md" bold>
                  {relationship.label}
                </Text>
              </Flex>
              {relationship.nodes.length > 0 ? (
                <Grid
                  columns="repeat(auto-fit, minmax(min(100%, 240px), 1fr))"
                  gap="md"
                  align="start"
                >
                  {relationship.nodes.map(node => (
                    <EntityNode key={node.key} entity={node} />
                  ))}
                </Grid>
              ) : (
                <Text size="md" variant="muted">
                  {relationship.unavailable}
                </Text>
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function RelationshipDiagram({item}: {item: WorkflowEngineDebuggerResponse['item']}) {
  const root = buildEntity(
    'root',
    ITEM_LABELS[item.type],
    {
      itemType: item.type,
      id: item.id,
      name: item.name,
      organizationId: item.organizationId,
      projectId: item.projectId,
      ...item.context,
    },
    RELATIONSHIPS[item.type]
  );

  return (
    <Stack gap="lg" minWidth="0">
      <Text size="md" variant="muted">
        Expand an entity to view its fields inline. Lines show the relationships returned
        in this response.
      </Text>
      {item.context.contextTruncated === true && (
        <Alert variant="warning">
          Context is truncated. Some conditions, actions, or related items are not
          included in this response.
        </Alert>
      )}
      <EntityNode entity={root} />
    </Stack>
  );
}

export function WorkflowEngineItemDetails({
  item,
}: {
  item: WorkflowEngineDebuggerResponse['item'];
}) {
  return (
    <RelationshipDiagram
      key={`${item.type}:${item.organizationId}:${item.projectId}:${item.id}`}
      item={item}
    />
  );
}
