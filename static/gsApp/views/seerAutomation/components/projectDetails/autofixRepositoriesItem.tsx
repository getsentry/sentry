import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button/button';
import {Input} from '@sentry/scraps/input/input';
import {Container} from '@sentry/scraps/layout/container';
import {Flex} from '@sentry/scraps/layout/flex';
import {Stack} from '@sentry/scraps/layout/stack';
import {Heading} from '@sentry/scraps/text/heading';
import {Text} from '@sentry/scraps/text/text';

import Confirm from 'sentry/components/confirm';
import type {
  BranchOverride,
  SeerRepoDefinition,
} from 'sentry/components/events/autofix/types';
import {isOverrideValid} from 'sentry/components/events/autofix/utils/isOverrideValid';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t, tct, tn} from 'sentry/locale';

import AutofixRepositoriesItemBranchOverride from 'getsentry/views/seerAutomation/components/projectDetails/autofixRepositoriesItemBranchOverride';

interface Props {
  canWrite: boolean;
  onRemoveRepo: () => void;
  onUpdateRepo: (updatedRepo: SeerRepoDefinition) => void;
  repositories: SeerRepoDefinition[];
  repository: SeerRepoDefinition;
}

const DEFAULT_OVERRIDE: BranchOverride = {tag_name: '', tag_value: '', branch_name: ''};

function areOverridesEqual(a: BranchOverride[], b: BranchOverride[]) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((override, idx) => {
    const other = b[idx];
    return (
      other &&
      override.branch_name === other.branch_name &&
      override.tag_name === other.tag_name &&
      override.tag_value === other.tag_value
    );
  });
}

export function AutofixRepositoriesItem({
  canWrite,
  repository,
  repositories,
  onRemoveRepo,
  onUpdateRepo,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  // We keep state with local overrides so the user can edit things without
  // sending incomplete changes to the server. All fields are required before
  // an override can be saved.
  const [localOverrides, setLocalOverrides] = useState<BranchOverride[]>(
    repository.branch_overrides || []
  );

  const handleUpdateOverride = useCallback(
    (idx: number, updatedOverride: BranchOverride) => {
      const newLocalOverrides = localOverrides.toSpliced(idx, 1, updatedOverride);
      setLocalOverrides(newLocalOverrides);

      // Only sync valid overrides to the server if they changed
      const branchOverrides = newLocalOverrides.filter(isOverrideValid);
      if (!areOverridesEqual(branchOverrides, repository.branch_overrides || [])) {
        onUpdateRepo({
          ...repository,
          branch_overrides: branchOverrides,
        });
      }
    },
    [localOverrides, repository, onUpdateRepo]
  );

  const handleRemoveOverride = useCallback(
    (idx: number) => {
      const newLocalOverrides = localOverrides.toSpliced(idx, 1);
      setLocalOverrides(newLocalOverrides);

      // Sync valid overrides to the server if they changed
      const branchOverrides = newLocalOverrides.filter(isOverrideValid);
      if (!areOverridesEqual(branchOverrides, repository.branch_overrides || [])) {
        onUpdateRepo({
          ...repository,
          branch_overrides: branchOverrides,
        });
      }
    },
    [localOverrides, repository, onUpdateRepo]
  );

  const handleAddOverride = useCallback(() => {
    setLocalOverrides([...localOverrides, {...DEFAULT_OVERRIDE}]);
  }, [localOverrides]);

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
          priority="transparent"
        >
          {repository.name}
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
              {tct('Are you sure you want to remove [repo] from Seer?', {
                repo: <code>{repository.name}</code>,
              })}
            </Heading>
          }
          message={
            repositories.length > 1
              ? tn(
                  'There will still be %s other repository connected to this project for Root Cause Analysis to use.',
                  'There will still be %s other repositories connected to this project for Root Cause Analysis to use.',
                  repositories.length - 1
                )
              : t('You will no longer be able to use Root Cause Analysis on your issue.')
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
            priority="transparent"
          />
        </Confirm>
      </Flex>

      {isExpanded && (
        <Container padding="lg xl" style={{gridColumn: '1 / -1'}}>
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
                onChange={e => onUpdateRepo({...repository, branch_name: e.target.value})}
                placeholder={t('Default branch')}
                size="sm"
                style={{width: '200px'}}
                value={repository.branch_name}
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
