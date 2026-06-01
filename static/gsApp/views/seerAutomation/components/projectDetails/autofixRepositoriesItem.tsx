import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Confirm} from 'sentry/components/confirm';
import type {
  SeerProjectRepo,
  SeerProjectRepoBranchOverrideInput,
  UpdateSeerProjectRepoInput,
} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerRepos';
import {isOverrideValid} from 'sentry/components/events/autofix/utils/isOverrideValid';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t, tct, tn} from 'sentry/locale';

import {AutofixRepositoriesItemBranchOverride} from 'getsentry/views/seerAutomation/components/projectDetails/autofixRepositoriesItemBranchOverride';

interface Props {
  canWrite: boolean;
  onRemoveRepo: () => void;
  onUpdateRepo: (update: UpdateSeerProjectRepoInput) => void;
  repository: SeerProjectRepo;
  repositoryCount: number;
}

const DEFAULT_OVERRIDE: SeerProjectRepoBranchOverrideInput = {
  tagName: '',
  tagValue: '',
  branchName: '',
};

function toOverrideInput(
  override: SeerProjectRepoBranchOverrideInput
): SeerProjectRepoBranchOverrideInput {
  return {
    tagName: override.tagName,
    tagValue: override.tagValue,
    branchName: override.branchName,
  };
}

function areOverridesEqual(
  a: SeerProjectRepoBranchOverrideInput[],
  b: SeerProjectRepoBranchOverrideInput[]
) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((override, idx) => {
    const other = b[idx];
    return (
      override.branchName === other?.branchName &&
      override.tagName === other.tagName &&
      override.tagValue === other.tagValue
    );
  });
}

export function AutofixRepositoriesItem({
  canWrite,
  repository,
  repositoryCount,
  onRemoveRepo,
  onUpdateRepo,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Local input state so typing isn't tied to a server round-trip; the branch
  // is persisted on blur (only when it actually changed).
  const [branchName, setBranchName] = useState(repository.branchName ?? '');

  const savedOverrides = repository.branchOverrides.map(toOverrideInput);

  // We keep state with local overrides so the user can edit things without
  // sending incomplete changes to the server. All fields are required before
  // an override can be saved.
  const [localOverrides, setLocalOverrides] = useState(savedOverrides);

  const handleUpdateOverride = (
    idx: number,
    updatedOverride: SeerProjectRepoBranchOverrideInput
  ) => {
    const newLocalOverrides = localOverrides.toSpliced(idx, 1, updatedOverride);
    setLocalOverrides(newLocalOverrides);

    // Only sync valid overrides to the server if they changed
    const branchOverrides = newLocalOverrides.filter(isOverrideValid);
    if (!areOverridesEqual(branchOverrides, savedOverrides)) {
      onUpdateRepo({branchOverrides});
    }
  };

  const handleRemoveOverride = (idx: number) => {
    const newLocalOverrides = localOverrides.toSpliced(idx, 1);
    setLocalOverrides(newLocalOverrides);

    // Sync valid overrides to the server if they changed
    const branchOverrides = newLocalOverrides.filter(isOverrideValid);
    if (!areOverridesEqual(branchOverrides, savedOverrides)) {
      onUpdateRepo({branchOverrides});
    }
  };

  const handleAddOverride = () => {
    setLocalOverrides([...localOverrides, {...DEFAULT_OVERRIDE}]);
  };

  return (
    <Fragment>
      <Flex
        align="center"
        gap="sm"
        height="100%"
        position="relative"
        padding="0"
        style={isExpanded ? {borderBottom: 'none'} : {}}
      >
        <RowButton
          icon={<IconChevron direction={isExpanded ? 'up' : 'down'} />}
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? t('Collapse') : t('Expand')}
          size="zero"
          variant="transparent"
        >
          <Text size="md">
            {[repository.owner, repository.name].filter(Boolean).join('/')}
          </Text>
        </RowButton>
      </Flex>

      <Flex
        gap="lg"
        align="center"
        justify="end"
        style={isExpanded ? {borderBottom: 'none'} : {}}
      >
        <Text size="sm">{repository.provider}</Text>
      </Flex>

      <Flex align="center" style={isExpanded ? {borderBottom: 'none'} : {}}>
        <Confirm
          disabled={!canWrite}
          onConfirm={onRemoveRepo}
          header={
            <Heading as="h4">
              {tct('Are you sure you want to remove [repo] from Autofix?', {
                repo: <code>{repository.name}</code>,
              })}
            </Heading>
          }
          message={
            repositoryCount > 1
              ? tn(
                  'There will still be %s other repository connected to this project for Autofix to use.',
                  'There will still be %s other repositories connected to this project for Autofix to use.',
                  repositoryCount - 1
                )
              : t('Autofix will be disabled for issues in this project.')
          }
          confirmText={
            <Flex align="center" gap="md">
              <IconDelete size="sm" />
              {t('Disconnect')}
            </Flex>
          }
          priority="danger"
        >
          <Button
            aria-label={t('Disconnect Repository')}
            icon={<IconDelete />}
            size="xs"
            variant="transparent"
          />
        </Confirm>
      </Flex>

      {isExpanded && (
        <Container padding="lg xl" column="1 / -1">
          <Stack gap="lg" justify="between" paddingTop="0" paddingLeft="xl">
            <Flex align="center" justify="between">
              <Heading as="h4">
                <Flex align="center" gap="sm">
                  {t('(Optional) Select Working Branch for Seer')}
                  <QuestionTooltip
                    title={t(
                      'Optionally provide a specific branch that Seer will work on. If left blank, Seer will use the default branch of the repository.'
                    )}
                    size="sm"
                  />
                </Flex>
              </Heading>
            </Flex>
            <Flex align="center" gap="sm">
              {t('By default, look at')}
              <Input
                disabled={!canWrite}
                nativeSize={10}
                onChange={e => setBranchName(e.target.value)}
                onBlur={() => {
                  if (branchName !== (repository.branchName ?? '')) {
                    onUpdateRepo({branchName: branchName || null});
                  }
                }}
                placeholder={t('Default branch')}
                size="sm"
                style={{width: '200px'}}
                value={branchName}
              />
            </Flex>
            {localOverrides.map((override, idx) => (
              <AutofixRepositoriesItemBranchOverride
                key={idx}
                canWrite={canWrite}
                onUpdateOverride={updated => handleUpdateOverride(idx, updated)}
                onRemoveOverride={() => handleRemoveOverride(idx)}
                override={override}
              />
            ))}
            <Flex align="center">
              <Button
                disabled={!canWrite}
                size="xs"
                icon={<IconAdd size="sm" />}
                onClick={handleAddOverride}
              >
                {t('Add Override')}
              </Button>
            </Flex>
          </Stack>
        </Container>
      )}
    </Fragment>
  );
}

const RowButton = styled(Button)`
  padding: ${p => p.theme.space.lg};
  justify-content: start;
  border-radius: 0;
  width: 100%;
  height: 100%;
`;
