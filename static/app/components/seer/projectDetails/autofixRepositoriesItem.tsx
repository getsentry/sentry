import {Fragment, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {
  AutoSaveContextProvider,
  AutoSaveForm,
  defaultFormOptions,
  useScrapsForm,
} from '@sentry/scraps/form';
import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Confirm} from 'sentry/components/confirm';
import {overrideHasAllValues} from 'sentry/components/seer/projectDetails/overrideHasAllValues';
import {overrideHasAnyValue} from 'sentry/components/seer/projectDetails/overrideHasAnyValue';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t, tct, tn} from 'sentry/locale';
import type {AvatarProject} from 'sentry/types/project';
import {getMutateSeerProjectRepoOptions} from 'sentry/utils/seer/seerProjectRepos';
import type {SeerProjectReposResponse} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props {
  canWrite: boolean;
  includeInstructions: boolean;
  onRemoveRepo: ({repoId}: {repoId: string}) => void;
  project: AvatarProject;
  repositories: SeerProjectReposResponse[];
  repository: SeerProjectReposResponse;
}

const overrideItemSchema = z
  .object({
    id: z.string(),
    branchName: z.string(),
    tagName: z.string(),
    tagValue: z.string(),
  })
  .superRefine((override, ctx) => {
    if (!overrideHasAnyValue(override)) {
      return;
    }
    if (!override.tagName.trim()) {
      ctx.addIssue({code: 'custom', path: ['tagName'], message: 'Required'});
    }
    if (!override.tagValue.trim()) {
      ctx.addIssue({code: 'custom', path: ['tagValue'], message: 'Required'});
    }
    if (!override.branchName.trim()) {
      ctx.addIssue({code: 'custom', path: ['branchName'], message: 'Required'});
    }
  });

const repoSchema = z.object({
  branchName: z.string().optional(),
  branchOverrides: z
    .array(overrideItemSchema)
    .transform(overrides => overrides.filter(overrideHasAllValues)),
  instructions: z.string().optional(),
});

export function AutofixRepositoriesItem({
  canWrite,
  includeInstructions,
  onRemoveRepo,
  project,
  repositories,
  repository,
}: Props) {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const [isExpanded, setIsExpanded] = useState(false);

  const mutationOptions = getMutateSeerProjectRepoOptions({
    organization,
    project,
    queryClient,
    repoId: repository.repositoryId,
  });

  const {mutateAsync: handleUpdateRepo, status: mutationStatus} =
    useMutation(mutationOptions);
  const resetOnErrorRef = useRef(false);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      branchOverrides: repository.branchOverrides,
    },
    validators: {
      onDynamic: repoSchema,
    },
    listeners: {
      onChangeDebounceMs: 1000,
      onChange: ({formApi}) => formApi.handleSubmit(),
    },
    onSubmit: ({value}) => handleUpdateRepo(repoSchema.parse(value)),
  });

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
          onConfirm={() => onRemoveRepo({repoId: repository.repositoryId})}
          header={
            <Heading as="h4">
              {tct('Are you sure you want to remove [repo] from Autofix?', {
                repo: <code>{repository.name}</code>,
              })}
            </Heading>
          }
          message={
            repositories.length > 1
              ? tn(
                  'There will still be %s other repository connected to this project for Autofix to use.',
                  'There will still be %s other repositories connected to this project for Autofix to use.',
                  repositories.length - 1
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
                  <InfoTip
                    title={t(
                      'Optionally provide a specific branch that Seer will work on. If left blank, Seer will use the default branch of the repository.'
                    )}
                    size="sm"
                  />
                </Flex>
              </Heading>
            </Flex>

            <AutoSaveForm
              name="branchName"
              schema={repoSchema}
              initialValue={repository.branchName}
              mutationOptions={mutationOptions}
            >
              {field => (
                <Flex align="center" gap="sm">
                  {t('By default, look at')}
                  <field.Input
                    size="sm"
                    disabled={!canWrite}
                    placeholder={t('Default branch')}
                    value={field.state.value ?? ''}
                    onChange={field.handleChange}
                  />
                </Flex>
              )}
            </AutoSaveForm>

            <form.AppForm form={form}>
              <form.AppField name="branchOverrides" mode="array">
                {fieldApi => (
                  <Stack gap="lg">
                    {fieldApi.state.value.map((override, i) => (
                      <AutoSaveContextProvider
                        key={`branchOverrides[${i}]`}
                        value={{
                          status: overrideHasAllValues(override)
                            ? mutationStatus
                            : overrideHasAnyValue(override)
                              ? 'error'
                              : 'idle',
                          resetOnErrorRef,
                        }}
                      >
                        <Flex align="center" gap="sm">
                          <form.AppField name={`branchOverrides[${i}].tagName`}>
                            {subField => (
                              <Fragment>
                                <Text wrap="nowrap">{t('When')}</Text>
                                <subField.Input
                                  disabled={!canWrite}
                                  onChange={subField.handleChange}
                                  placeholder={t('Tag name (e.g. environment)')}
                                  size="sm"
                                  value={subField.state.value}
                                  width="170px"
                                />
                              </Fragment>
                            )}
                          </form.AppField>
                          <form.AppField name={`branchOverrides[${i}].tagValue`}>
                            {subField => (
                              <Fragment>
                                <Text wrap="nowrap">{t('is')}</Text>
                                <subField.Input
                                  disabled={!canWrite}
                                  onChange={subField.handleChange}
                                  placeholder={t('Tag value (e.g. staging)')}
                                  size="sm"
                                  value={subField.state.value}
                                  width="170px"
                                />
                              </Fragment>
                            )}
                          </form.AppField>
                          <form.AppField name={`branchOverrides[${i}].branchName`}>
                            {subField => (
                              <Fragment>
                                <Text wrap="nowrap">{t('look at')}</Text>
                                <subField.Input
                                  disabled={!canWrite}
                                  onChange={subField.handleChange}
                                  placeholder={t('Branch name (e.g. dev)')}
                                  size="sm"
                                  value={subField.state.value}
                                  width="170px"
                                />
                              </Fragment>
                            )}
                          </form.AppField>
                          <Button
                            aria-label={t('Remove override')}
                            disabled={!canWrite}
                            icon={<IconDelete size="sm" />}
                            onClick={() => fieldApi.removeValue(i)}
                            variant="transparent"
                            size="xs"
                          />
                        </Flex>
                      </AutoSaveContextProvider>
                    ))}
                    <Flex align="center">
                      <Button
                        disabled
                        size="xs"
                        icon={<IconAdd size="sm" />}
                        tooltipProps={{
                          title: t('Branch overrides are no longer supported'),
                        }}
                        onClick={() =>
                          fieldApi.pushValue({
                            id: '',
                            tagName: '',
                            tagValue: '',
                            branchName: '',
                          })
                        }
                      >
                        {t('Add Override')}
                      </Button>
                    </Flex>
                  </Stack>
                )}
              </form.AppField>
            </form.AppForm>

            {includeInstructions && (
              <AutoSaveForm
                name="instructions"
                schema={repoSchema}
                initialValue={repository.instructions}
                mutationOptions={mutationOptions}
              >
                {field => (
                  <Stack gap="sm" borderTop="primary" paddingTop="lg">
                    <Heading as="h4">{t('Context for Seer')}</Heading>
                    <field.TextArea
                      size="sm"
                      rows={3}
                      disabled={!canWrite}
                      placeholder={t(
                        'Add any general context or instructions to help Seer understand this repository...'
                      )}
                      value={field.state.value ?? ''}
                      onChange={field.handleChange}
                    />
                  </Stack>
                )}
              </AutoSaveForm>
            )}
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
