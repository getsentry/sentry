import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import iconAndroid from 'sentry-logos/logo-android.svg';
import iconChrome from 'sentry-logos/logo-chrome.svg';
import iconEdgeLegacy from 'sentry-logos/logo-edge-old.svg';
import iconFirefox from 'sentry-logos/logo-firefox.svg';
import iconIe from 'sentry-logos/logo-ie.svg';
import iconOpera from 'sentry-logos/logo-opera.svg';
import iconSafari from 'sentry-logos/logo-safari.svg';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {
  AutoSaveForm,
  defaultFormOptions,
  FieldGroup,
  FormSearch,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Switch} from '@sentry/scraps/switch';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Access} from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {DetailedProject} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {makeDetailedProjectApiOptions} from 'sentry/utils/project/useDetailedProject';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

const filterDescriptions = {
  'browser-extensions': {
    label: t('Filter out errors known to be caused by browser extensions'),
    help: t(
      'Certain browser extensions will inject inline scripts and are known to cause errors.'
    ),
  },
  localhost: {
    label: t('Filter out events coming from localhost'),
    help: t('This applies to both IPv4 (``127.0.0.1``) and IPv6 (``::1``) addresses.'),
  },
  'filtered-transaction': {
    label: t('Filter out health check transactions'),
    help: tct(
      'Filter transactions that match most [commonNamingPatterns:common naming patterns] for health checks.',
      {
        commonNamingPatterns: (
          <ExternalLink href="https://docs.sentry.io/concepts/data-management/filtering/#transactions-coming-from-health-check" />
        ),
      }
    ),
  },
  'legacy-browser': {
    label: t('Filter out known errors from legacy browsers'),
    help: t(
      'Older browsers often give less accurate information, and while they may report valid issues, the context to understand them is incorrect or missing.'
    ),
  },
  'web-crawlers': {
    label: t('Filter out known web crawlers'),
    help: t(
      'Some crawlers may execute pages in incompatible ways which then cause errors that are unlikely to be seen by a normal user.'
    ),
  },
};

const LEGACY_BROWSER_SUBFILTERS = {
  chrome: {
    icon: iconChrome,
    title: 'Chrome',
    helpText: 'Version 110 and lower',
    legacy: false,
  },
  safari: {
    icon: iconSafari,
    title: 'Safari',
    helpText: 'Version 15 and lower',
    legacy: false,
  },
  safari_pre_6: {
    icon: iconSafari,
    helpText: '(Deprecated) Version 5 and lower',
    title: 'Safari',
    legacy: true,
  },
  firefox: {
    icon: iconFirefox,
    title: 'Firefox',
    helpText: 'Version 110 and lower',
    legacy: false,
  },
  android: {
    icon: iconAndroid,
    title: 'Android',
    helpText: 'Version 3 and lower',
    legacy: false,
  },
  android_pre_4: {
    icon: iconAndroid,
    helpText: '(Deprecated) Version 3 and lower',
    title: 'Android',
    legacy: true,
  },
  edge: {
    icon: iconEdgeLegacy,
    title: 'Edge',
    helpText: 'Version 110 and lower',
    legacy: false,
  },
  edge_pre_79: {
    icon: iconEdgeLegacy,
    helpText: '(Deprecated) Version 18 and lower',
    title: 'Edge (Legacy)',
    legacy: true,
  },
  ie: {
    icon: iconIe,
    title: 'Internet Explorer',
    helpText: 'Version 11 and lower',
    legacy: false,
  },
  ie_pre_9: {
    icon: iconIe,
    helpText: '(Deprecated) Version 8 and lower',
    title: 'Internet Explorer',
    legacy: true,
  },
  ie9: {
    icon: iconIe,
    helpText: '(Deprecated) Version 9',
    title: 'Internet Explorer',
    legacy: true,
  },
  ie10: {
    icon: iconIe,
    helpText: '(Deprecated) Version 10',
    title: 'Internet Explorer',
    legacy: true,
  },
  ie11: {
    icon: iconIe,
    helpText: '(Deprecated) Version 11',
    title: 'Internet Explorer',
    legacy: true,
  },
  opera: {
    icon: iconOpera,
    title: 'Opera',
    helpText: 'Version 99 and lower',
    legacy: false,
  },
  opera_pre_15: {
    icon: iconOpera,
    helpText: '(Deprecated) Version 14 and lower',
    title: 'Opera',
    legacy: true,
  },
  opera_mini: {
    icon: iconOpera,
    title: 'Opera Mini',
    helpText: 'Version 34 and lower',
    legacy: false,
  },
  opera_mini_pre_8: {
    icon: iconOpera,
    helpText: '(Deprecated) Version 8 and lower',
    title: 'Opera Mini',
    legacy: true,
  },
};

type LegacyBrowserSubfilterKeys = Array<keyof typeof LEGACY_BROWSER_SUBFILTERS>;

function getActiveSubfilters(): string[] {
  return Object.keys(LEGACY_BROWSER_SUBFILTERS).filter(
    key =>
      !LEGACY_BROWSER_SUBFILTERS[key as keyof typeof LEGACY_BROWSER_SUBFILTERS].legacy
  );
}

function getInitialSubfilters(active: boolean | string[]): string[] {
  switch (active) {
    case true:
      return getActiveSubfilters();
    case false:
      return [];
    default:
      return active;
  }
}

function LegacyBrowserFilterRow({
  subfilters,
  disabled,
  hintText,
  indicator,
  label,
  onToggle,
}: {
  hintText: React.ReactNode;
  label: React.ReactNode;
  onToggle: (newSubfilters: string[]) => void;
  subfilters: string[];
  disabled?: boolean;
  indicator?: React.ReactNode;
}) {
  const subfilterSet = new Set(subfilters);

  const toggleSubfilter = (subfilter: string) => {
    const newSet = new Set(subfilterSet);

    if (newSet.has(subfilter)) {
      newSet.delete(subfilter);
    } else {
      newSet.add(subfilter);
    }

    onToggle([...newSet]);
  };

  return (
    <Stack flexGrow={1} width="100%">
      <Flex align="center" gap="xs" justify="between">
        <Flex align="center" gap="xs">
          {label}
          <Grid flow="column" align="center" gap="md">
            <Button
              variant="link"
              onClick={() => onToggle(getActiveSubfilters())}
              disabled={disabled}
            >
              {t('All')}
            </Button>
            <Button variant="link" onClick={() => onToggle([])} disabled={disabled}>
              {t('None')}
            </Button>
          </Grid>
        </Flex>
        {indicator}
      </Flex>
      {hintText}
      <FilterGrid>
        {(Object.keys(LEGACY_BROWSER_SUBFILTERS) as LegacyBrowserSubfilterKeys)
          .filter(key => {
            if (!LEGACY_BROWSER_SUBFILTERS[key].legacy) {
              return true;
            }
            return subfilterSet.has(key);
          })
          .map(key => {
            const subfilter = LEGACY_BROWSER_SUBFILTERS[key];
            return (
              <FilterGridItem key={key}>
                <FilterGridIcon src={subfilter.icon} />
                <div>
                  <FilterTitle>{subfilter.title}</FilterTitle>
                  <FilterDescription>{subfilter.helpText}</FilterDescription>
                </div>
                <Switch
                  aria-label={`${subfilter.title} ${subfilter.helpText}`}
                  checked={subfilterSet.has(key)}
                  disabled={disabled}
                  onChange={() => toggleSubfilter(key)}
                  size="lg"
                />
              </FilterGridItem>
            );
          })}
      </FilterGrid>
    </Stack>
  );
}

const booleanFilterSchema = z.object({
  'browser-extensions': z.boolean(),
  localhost: z.boolean(),
  'filtered-transaction': z.boolean(),
  'web-crawlers': z.boolean(),
});

const projectBooleanSchema = z.object({
  'filters:react-hydration-errors': z.boolean(),
  'filters:chunk-load-error': z.boolean(),
});

const legacyBrowserSchema = z.object({'legacy-browsers': z.array(z.string())});

const customFiltersSchema = z.object({
  'filters:blacklisted_ips': z.string(),
  'filters:releases': z.string(),
  'filters:error_messages': z.string(),
  'filters:log_messages': z.string(),
  'filters:trace_metric_names': z.string(),
});

const newLineHelpText = t('Separate multiple entries with a newline.');
const globHelpText = tct('Allows [link:glob pattern matching].', {
  link: <ExternalLink href="https://en.wikipedia.org/wiki/Glob_(programming)" />,
});

function CustomFiltersForm({
  project,
  disabled,
}: {
  disabled: boolean;
  project: DetailedProject;
}) {
  const updateProject = useUpdateProject(project);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      'filters:blacklisted_ips': String(
        project.options?.['filters:blacklisted_ips'] ?? ''
      ),
      'filters:releases': String(project.options?.['filters:releases'] ?? ''),
      'filters:error_messages': String(project.options?.['filters:error_messages'] ?? ''),
      'filters:log_messages': String(project.options?.['filters:log_messages'] ?? ''),
      'filters:trace_metric_names': String(
        project.options?.['filters:trace_metric_names'] ?? ''
      ),
    },
    validators: {onDynamic: customFiltersSchema},
    onSubmit: ({value, formApi}) =>
      updateProject
        .mutateAsync({options: value})
        .then(() => {
          formApi.reset(value);
          addSuccessMessage(t('Filter settings saved.'));
        })
        .catch(() => {
          addErrorMessage(t('Unable to save filter changes.'));
        }),
  });

  return (
    <form.AppForm form={form}>
      <FormSearch route="/settings/:orgId/projects/:projectId/filters/">
        <FieldGroup title={t('Custom Filters')}>
          <form.AppField name="filters:blacklisted_ips">
            {field => (
              <field.Layout.Row
                label={t('IP Addresses')}
                hintText={
                  <Fragment>
                    {t('Filter events from these IP addresses. ')}
                    {newLineHelpText}
                  </Fragment>
                }
              >
                <field.TextArea
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled={disabled}
                  monospace
                  autosize
                  rows={1}
                  maxRows={10}
                  placeholder="e.g. 127.0.0.1 or 10.0.0.0/8"
                />
              </field.Layout.Row>
            )}
          </form.AppField>

          <Feature
            features="projects:custom-inbound-filters"
            overrideName="feature-disabled:custom-inbound-filters"
            project={project}
            renderDisabled={({children, ...props}) => {
              if (typeof children === 'function') {
                return children({
                  ...props,
                  renderDisabled: p => (
                    <FeatureDisabled
                      featureName={t('Custom Inbound Filters')}
                      features={p.features}
                      alert={PanelAlert}
                      message={t(
                        'Release and Error Message filtering are not enabled on your Sentry installation'
                      )}
                    />
                  ),
                });
              }
              return null;
            }}
          >
            {({hasFeature, organization, renderDisabled, ...featureProps}) => (
              <Fragment>
                {!hasFeature &&
                  typeof renderDisabled === 'function' &&
                  renderDisabled({
                    organization,
                    hasFeature,
                    children: null,
                    ...featureProps,
                  })}

                <form.AppField name="filters:releases">
                  {field => (
                    <field.Layout.Row
                      label={t('Releases')}
                      hintText={
                        <Fragment>
                          {t('Filter events from these releases. ')}
                          {newLineHelpText} {globHelpText}
                        </Fragment>
                      }
                    >
                      <field.TextArea
                        value={field.state.value}
                        onChange={field.handleChange}
                        disabled={disabled || !hasFeature}
                        monospace
                        autosize
                        rows={1}
                        maxRows={10}
                        placeholder="e.g. 1.* or [!3].[0-9].*"
                      />
                    </field.Layout.Row>
                  )}
                </form.AppField>

                <form.AppField name="filters:error_messages">
                  {field => (
                    <field.Layout.Row
                      label={t('Error Message')}
                      hintText={
                        <Fragment>
                          {t('Filter events by error messages. ')}
                          {newLineHelpText} {globHelpText}{' '}
                          {t(
                            'Exceptions are matched on "<type>: <message>", for example "TypeError: *".'
                          )}
                        </Fragment>
                      }
                    >
                      <field.TextArea
                        value={field.state.value}
                        onChange={field.handleChange}
                        disabled={disabled || !hasFeature}
                        monospace
                        autosize
                        rows={1}
                        maxRows={10}
                        placeholder="e.g. TypeError* or *: integer division or modulo by zero"
                      />
                    </field.Layout.Row>
                  )}
                </form.AppField>

                {organization.features.includes('ourlogs-ingestion') && (
                  <form.AppField name="filters:log_messages">
                    {field => (
                      <field.Layout.Row
                        label={t('Log Message')}
                        hintText={
                          <Fragment>
                            {t('Filter logs by messages. ')}
                            {newLineHelpText} {globHelpText}{' '}
                            {t(
                              'Logs are matched on "<message>", for example "Rate limit*".'
                            )}
                          </Fragment>
                        }
                      >
                        <field.TextArea
                          value={field.state.value}
                          onChange={field.handleChange}
                          disabled={disabled || !hasFeature}
                          monospace
                          autosize
                          rows={1}
                          maxRows={10}
                          placeholder="e.g. Rate limit* or *connection"
                        />
                      </field.Layout.Row>
                    )}
                  </form.AppField>
                )}

                {organization.features.includes('tracemetrics-ingestion') && (
                  <form.AppField name="filters:trace_metric_names">
                    {field => (
                      <field.Layout.Row
                        label={t('Application Metrics')}
                        hintText={
                          <Fragment>
                            {t('Filter application metrics by name. ')}
                            {newLineHelpText} {globHelpText}{' '}
                            {t(
                              'Application metrics are matched on the metric name, for example "my_metric.*".'
                            )}
                          </Fragment>
                        }
                      >
                        <field.TextArea
                          value={field.state.value}
                          onChange={field.handleChange}
                          disabled={disabled || !hasFeature}
                          monospace
                          autosize
                          rows={1}
                          maxRows={10}
                          placeholder="e.g. my_metric.*"
                        />
                      </field.Layout.Row>
                    )}
                  </form.AppField>
                )}

                {hasFeature && project.options?.['filters:error_messages'] && (
                  <PanelAlert variant="warning" data-test-id="error-message-disclaimer">
                    {t(
                      "Minidumps, obfuscated or minified exceptions (ProGuard, errors in the minified production build of React), and Internet Explorer's i18n errors cannot be filtered by message."
                    )}
                  </PanelAlert>
                )}
              </Fragment>
            )}
          </Feature>

          {!disabled && (
            <Flex gap="sm" align="center">
              <form.Subscribe selector={state => state.isDirty}>
                {isDirty =>
                  isDirty ? (
                    <Alert variant="info">
                      {t('Changing this filter will apply to all new events.')}
                    </Alert>
                  ) : null
                }
              </form.Subscribe>
              <Flex gap="sm" justify="end" flexGrow={1}>
                <form.ResetButton>{t('Cancel')}</form.ResetButton>
                <form.SubmitButton>{t('Save')}</form.SubmitButton>
              </Flex>
            </Flex>
          )}
        </FieldGroup>
      </FormSearch>
    </form.AppForm>
  );
}

type Props = {
  params: {
    projectId: string;
  };
  project: DetailedProject;
};

type Filter = {
  active: boolean | string[];
  description: string;
  id: string;
  name: string;
};

type StandardFilterId = keyof z.infer<typeof booleanFilterSchema>;
type ProjectBooleanFilterId = keyof z.infer<typeof projectBooleanSchema>;

function StandardFilter({
  description,
  filter,
  filtersEndpoint,
  hasAccess,
  organization,
  project,
  onUpdate,
}: {
  description: (typeof filterDescriptions)[keyof typeof filterDescriptions];
  filter: Filter;
  filtersEndpoint: string;
  hasAccess: boolean;
  onUpdate: (filterId: string, active: boolean | string[]) => boolean | string[];
  organization: Organization;
  project: DetailedProject;
}) {
  const name = filter.id as StandardFilterId;

  return (
    <AutoSaveForm
      name={name}
      schema={booleanFilterSchema}
      initialValue={!!filter.active}
      mutationOptions={{
        mutationFn: (data: Record<StandardFilterId, boolean>) => {
          trackAnalytics('settings.inbound_filter_updated', {
            organization,
            project_id: parseInt(project.id, 10),
            filter: filter.id,
            new_state: data[name] ? 'enabled' : 'disabled',
          });
          return fetchMutation({
            url: `${filtersEndpoint}${filter.id}/`,
            method: 'PUT',
            data: {active: data[name]},
          });
        },
        onMutate: data => ({
          previousActive: onUpdate(filter.id, data[name]),
        }),
        onError: (_error, _data, context) => {
          if (context) {
            onUpdate(filter.id, context.previousActive);
          }
        },
      }}
    >
      {field => (
        <field.Layout.Row label={description.label} hintText={description.help}>
          <field.Switch
            checked={field.state.value}
            onChange={field.handleChange}
            disabled={!hasAccess}
          />
        </field.Layout.Row>
      )}
    </AutoSaveForm>
  );
}

export function ProjectFiltersSettings({project, params}: Props) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {projectId: projectSlug} = params;
  const filtersEndpoint = `/projects/${organization.slug}/${projectSlug}/filters/`;
  const detailedProjectQueryOptions = makeDetailedProjectApiOptions({
    orgSlug: organization.slug,
    projectSlug,
  });
  const {data: currentProject = project} = useQuery({
    ...detailedProjectQueryOptions,
    initialData: {headers: {}, json: project},
  });

  const updateProject = useUpdateProject(project);

  const getProjectBooleanMutationOptions = <TName extends ProjectBooleanFilterId>({
    name,
  }: {
    name: TName;
  }) => ({
    mutationFn: (data: Record<TName, boolean>) => {
      trackAnalytics('settings.inbound_filter_updated', {
        organization,
        project_id: parseInt(project.id, 10),
        filter: name,
        new_state: data[name] ? 'enabled' : 'disabled',
      });
      return updateProject.mutateAsync({options: data});
    },
  });

  const filterQueryOptions = apiOptions.as<Filter[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/filters/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
        projectIdOrSlug: projectSlug,
      },
      staleTime: 0,
    }
  );

  const {
    data: filterListData,
    isPending,
    isError,
    refetch,
  } = useQuery(filterQueryOptions);

  const filterList = filterListData ?? [];

  const updateFilterCache = (filterId: string, active: boolean | string[]) => {
    const previous = filterList.find(f => f.id === filterId)?.active ?? false;
    queryClient.setQueryData(filterQueryOptions.queryKey, prev =>
      prev
        ? {
            ...prev,
            json: prev.json.map(f => (f.id === filterId ? {...f, active} : f)),
          }
        : prev
    );
    return previous;
  };

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <FormSearch route="/settings/:orgId/projects/:projectId/filters/">
      <Access access={['project:write']} project={project}>
        {({hasAccess}) => (
          <Fragment>
            <FieldGroup title={t('Filters')}>
              {filterList.map(filter => {
                if (filter.id === 'legacy-browsers') {
                  return (
                    <AutoSaveForm
                      key={filter.id}
                      name="legacy-browsers"
                      schema={legacyBrowserSchema}
                      initialValue={getInitialSubfilters(filter.active)}
                      mutationOptions={{
                        mutationFn: (data: {'legacy-browsers': string[]}) => {
                          const newSubfilters = data['legacy-browsers'];
                          trackAnalytics('settings.inbound_filter_updated', {
                            organization,
                            project_id: parseInt(project.id, 10),
                            filter: filter.id,
                            new_state: [...newSubfilters].sort().join(','),
                          });
                          return fetchMutation({
                            url: `${filtersEndpoint}${filter.id}/`,
                            method: 'PUT',
                            data: {subfilters: newSubfilters},
                          });
                        },
                        onMutate: data => ({
                          previousActive: updateFilterCache(
                            filter.id,
                            data['legacy-browsers']
                          ),
                        }),
                        onError: (_error, _data, context) => {
                          if (context) {
                            updateFilterCache(filter.id, context.previousActive);
                          }
                        },
                      }}
                    >
                      {field => (
                        <field.Base disabled={!hasAccess}>
                          {(baseProps, {indicator}) => (
                            <LegacyBrowserFilterRow
                              subfilters={field.state.value}
                              disabled={baseProps.disabled}
                              hintText={
                                <field.Meta.HintText>
                                  {t(
                                    'The browser versions filtered out will be periodically evaluated and updated.'
                                  )}
                                </field.Meta.HintText>
                              }
                              indicator={indicator}
                              label={
                                <field.Meta.Label>
                                  {t('Filter out legacy browsers')}
                                </field.Meta.Label>
                              }
                              onToggle={newSubfilters => {
                                field.handleChange(newSubfilters);
                                baseProps.onBlur();
                              }}
                            />
                          )}
                        </field.Base>
                      )}
                    </AutoSaveForm>
                  );
                }

                const desc =
                  filterDescriptions[filter.id as keyof typeof filterDescriptions];
                if (!desc) {
                  return null;
                }

                return (
                  <StandardFilter
                    key={filter.id}
                    description={desc}
                    filter={filter}
                    filtersEndpoint={filtersEndpoint}
                    hasAccess={hasAccess}
                    organization={organization}
                    project={project}
                    onUpdate={updateFilterCache}
                  />
                );
              })}

              <AutoSaveForm
                name="filters:react-hydration-errors"
                schema={projectBooleanSchema}
                initialValue={
                  !!currentProject.options?.['filters:react-hydration-errors']
                }
                mutationOptions={getProjectBooleanMutationOptions({
                  name: 'filters:react-hydration-errors',
                })}
              >
                {field => (
                  <field.Layout.Row
                    label={t('Filter out hydration errors')}
                    hintText={tct(
                      'React falls back to do a full re-render on a page. [replaySettings: Hydration Errors created from captured replays] are excluded from this setting.',
                      {
                        replaySettings: (
                          <Link
                            to={`/settings/${organization.slug}/projects/${currentProject.slug}/replays/#sentry-replay_hydration_error_issues_help`}
                          />
                        ),
                      }
                    )}
                  >
                    <field.Switch
                      checked={field.state.value}
                      onChange={field.handleChange}
                      disabled={!hasAccess}
                    />
                  </field.Layout.Row>
                )}
              </AutoSaveForm>

              <AutoSaveForm
                name="filters:chunk-load-error"
                schema={projectBooleanSchema}
                initialValue={!!currentProject.options?.['filters:chunk-load-error']}
                mutationOptions={getProjectBooleanMutationOptions({
                  name: 'filters:chunk-load-error',
                })}
              >
                {field => (
                  <field.Layout.Row
                    label={t('Filter out ChunkLoadError(s)')}
                    hintText={t(
                      "ChunkLoadErrors can happen in applications powered by Webpack or Turbopack when code chunks can't be found on the server. This often occurs during a redeploy of the website while users have the old page open. A page refresh usually resolves the issue."
                    )}
                  >
                    <field.Switch
                      checked={field.state.value}
                      onChange={field.handleChange}
                      disabled={!hasAccess}
                    />
                  </field.Layout.Row>
                )}
              </AutoSaveForm>
            </FieldGroup>

            <CustomFiltersForm project={currentProject} disabled={!hasAccess} />
          </Fragment>
        )}
      </Access>
    </FormSearch>
  );
}

const FilterGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${p => p.theme.space.lg};
  margin-top: ${p => p.theme.space.xl};
`;

const FilterGridItem = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  gap: ${p => p.theme.space.md};
  align-items: center;
  background: ${p => p.theme.tokens.background.secondary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.lg};
`;

const FilterGridIcon = styled('img')`
  width: 38px;
  height: 38px;
`;

const FilterTitle = styled('div')`
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  white-space: nowrap;
`;

const FilterDescription = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  white-space: nowrap;
`;
