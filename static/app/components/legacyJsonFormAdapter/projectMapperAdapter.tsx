import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {openProjectCreationModal} from 'sentry/actionCreators/modal';
import {IdBadge} from 'sentry/components/idBadge';
import {
  IconAdd,
  IconArrow,
  IconDelete,
  IconGeneric,
  IconOpen,
  IconVercel,
} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {JsonFormAdapterFieldConfig} from './types';

type ProjectMapperConfig = Extract<JsonFormAdapterFieldConfig, {type: 'project_mapper'}>;

type MappedValue = [number, string];

function getIcon(iconType?: string) {
  switch (iconType) {
    case 'vercel':
      return <IconVercel />;
    default:
      return <IconGeneric />;
  }
}

interface ProjectMapperAddRowProps {
  config: ProjectMapperConfig;
  onAdd: (value: MappedValue[]) => void;
  value: MappedValue[];
  disabled?: boolean;
  indicator?: React.ReactNode;
}

export function ProjectMapperAddRow({
  config,
  value,
  onAdd,
  indicator,
  disabled,
}: ProjectMapperAddRowProps) {
  const [selectedMappedValue, setSelectedMappedValue] = useState<string | null>(null);
  const [selectedSentryProjectId, setSelectedSentryProjectId] = useState<number | null>(
    null
  );

  const mappedValuesUsed = new Set(value.map(tuple => tuple[1]));
  const mappedItems = config.mappedDropdown?.items ?? [];
  const availableMappedItems = mappedItems.filter(
    item => !mappedValuesUsed.has(item.value)
  );

  const sentryProjects = config.sentryProjects ?? [];
  const sentryProjectOptions = [
    {label: t('Create a Project'), value: -1, leadingItems: <IconAdd />},
    ...sentryProjects.map(({slug, id}) => ({
      label: slug,
      value: id,
      leadingItems: (
        <IdBadge
          project={{id, slug}}
          avatarProps={{consistentWidth: true}}
          avatarSize={16}
          disableLink
          hideName
        />
      ),
    })),
  ];

  const handleSelectSentryProject = (option: {value: number} | null) => {
    if (option?.value === -1) {
      openProjectCreationModal({
        defaultCategory: config.iconType === 'vercel' ? 'browser' : 'popular',
      });
      return;
    }
    setSelectedSentryProjectId(option ? option.value : null);
  };

  const mappedItemOptions = availableMappedItems.map(item => ({
    label: item.label,
    value: item.value,
    leadingItems: getIcon(config.iconType),
  }));

  const handleAdd = () => {
    if (selectedSentryProjectId === null || selectedMappedValue === null) {
      return;
    }
    const newValue: MappedValue[] = [
      ...value,
      [selectedSentryProjectId, selectedMappedValue],
    ];
    onAdd(newValue);
    setSelectedMappedValue(null);
    setSelectedSentryProjectId(null);
  };

  return (
    <Flex align="center" gap="md">
      <Container flex={1} minWidth={0}>
        <Select
          placeholder={config.mappedDropdown?.placeholder ?? t('Select\u2026')}
          options={mappedItemOptions}
          onChange={(option: {value: string} | null) =>
            setSelectedMappedValue(option ? option.value : null)
          }
          value={selectedMappedValue}
          disabled={disabled}
        />
      </Container>
      <IconArrow size="xs" direction="right" />
      <Container flex={1} minWidth={0}>
        <Select
          placeholder={t('Sentry project\u2026')}
          options={sentryProjectOptions}
          onChange={handleSelectSentryProject}
          value={selectedSentryProjectId}
          disabled={disabled}
        />
      </Container>
      <Button
        size="sm"
        priority="primary"
        onClick={handleAdd}
        icon={<IconAdd />}
        disabled={disabled || !selectedSentryProjectId || !selectedMappedValue}
        aria-label={t('Add project')}
      />
      <Flex minWidth="14px">{indicator}</Flex>
    </Flex>
  );
}

interface ProjectMapperTableProps {
  config: ProjectMapperConfig;
  onDelete: (value: MappedValue[]) => void;
  value: MappedValue[];
  disabled?: boolean;
}

export function ProjectMapperTable({
  config,
  value,
  onDelete,
  disabled,
}: ProjectMapperTableProps) {
  if (value.length === 0) {
    return null;
  }

  const sentryProjectsById = Object.fromEntries(
    (config.sentryProjects ?? []).map(project => [project.id, project])
  );

  const mappedItemsByValue = Object.fromEntries(
    (config.mappedDropdown?.items ?? []).map(item => [item.value, item])
  );

  const handleDelete = (index: number) => {
    const newValue = [...value.slice(0, index), ...value.slice(index + 1)];
    onDelete(newValue);
  };

  return (
    <div>
      {value.map(([projectId, mappedValue], index) => {
        const project = sentryProjectsById[projectId];
        const mappedItem = mappedItemsByValue[mappedValue];

        return (
          <div key={index}>
            <Flex align="center" gap="md">
              <Flex flex="1 1 0" align="center" gap="md">
                {mappedItem ? (
                  <Flex align="center" gap="md">
                    {getIcon(config.iconType)}
                    <Text>{mappedItem.label}</Text>
                    {mappedItem.url && (
                      <ExternalLink href={mappedItem.url}>
                        <IconOpen size="xs" />
                      </ExternalLink>
                    )}
                  </Flex>
                ) : (
                  <Text variant="muted">{t('Deleted')}</Text>
                )}
              </Flex>
              <IconArrow size="xs" direction="right" />
              <Flex flex="1 1 0" align="center">
                {project ? (
                  <IdBadge
                    project={{
                      ...project,
                      platform: (project.platform as any) ?? undefined,
                    }}
                    avatarSize={20}
                    displayName={project.slug}
                    avatarProps={{consistentWidth: true}}
                  />
                ) : (
                  <Text variant="muted">{t('Deleted')}</Text>
                )}
              </Flex>
              <Button
                icon={<IconDelete />}
                size="sm"
                disabled={disabled}
                onClick={() => handleDelete(index)}
                aria-label={t('Delete')}
              />
              {/* Reserve space to align with the indicator next to the Add button */}
              <Flex minWidth="14px" />
            </Flex>
          </div>
        );
      })}
    </div>
  );
}
