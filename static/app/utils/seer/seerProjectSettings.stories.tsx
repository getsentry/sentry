import {useMemo} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {parseAsString, useQueryState, type inferParserType} from 'nuqs';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PreferredAgentLabel} from 'sentry/components/seer/preferredAgent';
import {StoppingPointLabel} from 'sentry/components/seer/stoppingPoint';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import {useAgentSelectOptions, useKnownAgents} from 'sentry/utils/seer/preferredAgent';
import {
  getMutateSeerProjectSettingsOptions,
  getSeerProjectSettingsQueryOptions,
  seerProjectSettingsSchema,
} from 'sentry/utils/seer/seerProjectSettings';
import {
  getUserFacingStoppingPoint,
  useStoppingPointSelectOptions,
} from 'sentry/utils/seer/stoppingPoint';
import type {SeerAgent} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

function PickProject({children}: {children: (projectSlug: string) => React.ReactNode}) {
  const {projects} = useProjects();
  const [projectSlug, setProjectSlug] = useQueryState('project', parseAsString);

  const projectOptions = useMemo(
    () => projects.map(p => ({value: p.slug, label: p.slug})),
    [projects]
  );

  return (
    <Flex direction="column" gap="lg">
      <CompactSelect<NonNullable<inferParserType<typeof parseAsString>>>
        onChange={selected => setProjectSlug(selected.value)}
        options={projectOptions}
        search
        size="xs"
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps} prefix="Project" />
        )}
        value={projectSlug ?? undefined}
      />
      {projectSlug ? (
        children(projectSlug)
      ) : (
        <Flex justify="center" padding="xl">
          <Text variant="muted">{t('Select a project to view settings')}</Text>
        </Flex>
      )}
    </Flex>
  );
}

export default Storybook.story('SeerProjectSettings', story => {
  story('Autofix Project Settings', () => {
    function Example({projectSlug}: {projectSlug: string}) {
      const organization = useOrganization();

      const {data, isLoading, isError, error} = useQuery({
        ...getSeerProjectSettingsQueryOptions({
          organization,
          project: {slug: projectSlug ?? ''},
        }),
        enabled: !!projectSlug,
      });

      if (isLoading) {
        return (
          <Flex justify="center" padding="xl">
            <LoadingIndicator />
          </Flex>
        );
      }
      if (isError) {
        return (
          <Flex justify="center" padding="xl">
            <Text variant="muted">{t('Error: %s', error?.message)}</Text>
          </Flex>
        );
      }

      if (!data) {
        return (
          <Flex justify="center" padding="xl">
            <Text variant="muted">{t('No data found')}</Text>
          </Flex>
        );
      }

      return (
        <SimpleTable style={{gridTemplateColumns: '2fr max-content repeat(4, 1fr)'}}>
          <SimpleTable.Header>
            <SimpleTable.HeaderCell>{t('Project')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Repos')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Agent')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Agent (fmt)')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Stopping Point')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Stopping Point (fmt)')}</SimpleTable.HeaderCell>
          </SimpleTable.Header>
          <SimpleTable.Row>
            <SimpleTable.RowCell>
              <Text bold>{data.projectSlug}</Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text>{data.reposCount}</Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text>{data.agent}</Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text>
                <PreferredAgentLabel settings={data} />
              </Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text>{data.stoppingPoint}</Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text>
                <StoppingPointLabel
                  stoppingPoint={getUserFacingStoppingPoint(data.stoppingPoint)}
                />
              </Text>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        </SimpleTable>
      );
    }

    return (
      <PickProject>{projectSlug => <Example projectSlug={projectSlug} />}</PickProject>
    );
  });

  story('Edit Agent', () => {
    function Example({projectSlug}: {projectSlug: string}) {
      const organization = useOrganization();
      const queryClient = useQueryClient();
      const knownAgents = useKnownAgents();

      const agentSelectOptions = useAgentSelectOptions();
      const {data, isLoading, isError, error} = useQuery({
        ...getSeerProjectSettingsQueryOptions({
          organization,
          project: {slug: projectSlug ?? ''},
        }),
        enabled: !!projectSlug,
      });

      if (isLoading) {
        return (
          <Flex justify="center" padding="xl">
            <LoadingIndicator />
          </Flex>
        );
      }

      if (isError) {
        return (
          <Flex justify="center" padding="xl">
            <Text variant="muted">{t('Error: %s', error.message)}</Text>
          </Flex>
        );
      }

      if (!data) {
        return (
          <Flex justify="center" padding="xl">
            <Text variant="muted">{t('No data found')}</Text>
          </Flex>
        );
      }

      return (
        <FieldGroup>
          <AutoSaveForm
            name="agent"
            schema={seerProjectSettingsSchema}
            initialValue={data.agent}
            mutationOptions={getMutateSeerProjectSettingsOptions({
              organization,
              project: {slug: projectSlug},
              queryClient,
              knownAgents,
            })}
          >
            {field => (
              <field.Layout.Row
                label={t('Agent')}
                hintText={t('Select which agent should handle autofix for this project.')}
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={
                    agentSelectOptions as Array<{
                      label: string;
                      value: SeerAgent;
                    }>
                  }
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        </FieldGroup>
      );
    }

    return (
      <PickProject>{projectSlug => <Example projectSlug={projectSlug} />}</PickProject>
    );
  });

  story('Edit Stopping Point', () => {
    function Example({projectSlug}: {projectSlug: string}) {
      const organization = useOrganization();

      const queryClient = useQueryClient();

      const stoppingPointOptions = useStoppingPointSelectOptions();
      const {data, isLoading, isError, error} = useQuery({
        ...getSeerProjectSettingsQueryOptions({
          organization,
          project: {slug: projectSlug ?? ''},
        }),
        enabled: !!projectSlug,
      });

      if (isLoading) {
        return (
          <Flex justify="center" padding="xl">
            <LoadingIndicator />
          </Flex>
        );
      }

      if (isError) {
        return (
          <Flex justify="center" padding="xl">
            <Text variant="muted">{t('Error: %s', error.message)}</Text>
          </Flex>
        );
      }

      if (!data) {
        return (
          <Flex justify="center" padding="xl">
            <Text variant="muted">{t('No data found')}</Text>
          </Flex>
        );
      }

      return (
        <FieldGroup>
          <AutoSaveForm
            name="stopping_point"
            schema={seerProjectSettingsSchema}
            initialValue={getUserFacingStoppingPoint(data.stoppingPoint)}
            mutationOptions={getMutateSeerProjectSettingsOptions({
              organization,
              project: {slug: projectSlug},
              queryClient,
            })}
          >
            {field => (
              <field.Layout.Row
                label={t('Stopping Point')}
                hintText={t(
                  'Choose which step Seer should stop at when running automatically.'
                )}
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={stoppingPointOptions}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        </FieldGroup>
      );
    }

    return (
      <PickProject>{projectSlug => <Example projectSlug={projectSlug} />}</PickProject>
    );
  });
});
