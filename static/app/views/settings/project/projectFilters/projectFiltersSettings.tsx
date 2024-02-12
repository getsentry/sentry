import {Component, Fragment, useCallback} from 'react';
import styled from '@emotion/styled';
import iconAndroid from 'sentry-logos/logo-android.svg';
import iconChrome from 'sentry-logos/logo-chrome.svg';
import iconEdgeLegacy from 'sentry-logos/logo-edge-old.svg';
import iconFirefox from 'sentry-logos/logo-firefox.svg';
import iconIe from 'sentry-logos/logo-ie.svg';
import iconOpera from 'sentry-logos/logo-opera.svg';
import iconSafari from 'sentry-logos/logo-safari.svg';

import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import FieldHelp from 'sentry/components/forms/fieldGroup/fieldHelp';
import FieldLabel from 'sentry/components/forms/fieldGroup/fieldLabel';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import JsonForm from 'sentry/components/forms/jsonForm';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import Switch from 'sentry/components/switchButton';
import filterGroups, {
  customFilterFields,
  getOptionsData,
} from 'sentry/data/forms/inboundFilters';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

const filterDescriptions = {
  'browser-extensions': {
    label: t('Filter out errors known to be caused by browser extensions'),
    help: t(
      'Certain browser extensions will inject inline scripts and are known to cause errors.'
    ),
  },
  localhost: {
    label: t('Filter out events coming from localhost'),
    help: 'This applies to both IPv4 (``127.0.0.1``) and IPv6 (``::1``) addresses.',
  },
  'filtered-transaction': {
    label: t('Filter out health check transactions'),
    help: tct(
      'Filter transactions that match most [commonNamingPatterns:common naming patterns] for health checks.',
      {
        commonNamingPatterns: (
          <ExternalLink href="https://docs.sentry.io/product/data-management-settings/filtering/#transactions-coming-from-health-check" />
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
  safari_pre_6: {
    icon: iconSafari,
    helpText: '(Deprecated) Version 5 and lower',
    title: 'Safari',
    legacy: true,
  },
  opera_pre_15: {
    icon: iconOpera,
    helpText: '(Deprecated) Version 14 and lower',
    title: 'Opera',
    legacy: true,
  },
  opera_mini_pre_8: {
    icon: iconOpera,
    helpText: '(Deprecated) Version 8 and lower',
    title: 'Opera Mini',
    legacy: true,
  },
  android_pre_4: {
    icon: iconAndroid,
    helpText: '(Deprecated) Version 3 and lower',
    title: 'Android',
    legacy: true,
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
    helpText: 'Verison 11 and lower',
    legacy: false,
  },
  safari: {
    icon: iconSafari,
    title: 'Safari',
    helpText: 'Version 11 and lower',
    legacy: false,
  },
  opera: {
    icon: iconOpera,
    title: 'Opera',
    helpText: 'Version 50 and lower',
  },
  opera_mini: {
    icon: iconOpera,
    title: 'Opera Mini',
    helpText: 'Version 34 and lower',
    legacy: false,
  },
  android: {
    icon: iconAndroid,
    title: 'Android',
    helpText: 'Version 3 and lower',
    legacy: false,
  },
  edge: {
    icon: iconEdgeLegacy,
    title: 'Edge',
    helpText: 'Version 78 and lower',
    legacy: false,
  },
  firefox: {
    icon: iconFirefox,
    title: 'Firefox',
    helpText: 'Version 66 and lower',
    legacy: false,
  },
  chrome: {
    icon: iconChrome,
    title: 'Chrome',
    helpText: 'Version 62 and lower',
    legacy: false,
  },
};

type FormFieldProps = React.ComponentProps<typeof FormField>;

type RowProps = {
  data: {
    active: string[] | boolean;
  };
  hasLegacyBrowserUpdate: boolean;
  onToggle: (
    data: RowProps['data'],
    filters: RowState['subfilters'],
    event: React.MouseEvent
  ) => void;
  disabled?: boolean;
};

type RowState = {
  error: boolean | Error;
  loading: boolean;
  subfilters: Set<string>;
};

class LegacyBrowserFilterRow extends Component<RowProps, RowState> {
  constructor(props) {
    super(props);

    let initialSubfilters;
    if (props.data.active === true) {
      initialSubfilters = new Set(
        Object.keys(LEGACY_BROWSER_SUBFILTERS).filter(
          key =>
            LEGACY_BROWSER_SUBFILTERS[key].legacy === !this.props.hasLegacyBrowserUpdate
        )
      );
    } else if (props.data.active === false) {
      initialSubfilters = new Set();
    } else {
      initialSubfilters = new Set(props.data.active);
    }

    this.state = {
      loading: false,
      error: false,
      subfilters: initialSubfilters,
    };
  }

  handleToggleSubfilters = (subfilter, e) => {
    let {subfilters} = this.state;

    if (subfilter === true) {
      subfilters = new Set(
        Object.keys(LEGACY_BROWSER_SUBFILTERS).filter(
          key =>
            LEGACY_BROWSER_SUBFILTERS[key].legacy === !this.props.hasLegacyBrowserUpdate
        )
      );
    } else if (subfilter === false) {
      subfilters = new Set();
    } else if (subfilters.has(subfilter)) {
      subfilters.delete(subfilter);
    } else {
      subfilters.add(subfilter);
    }

    this.setState(
      {
        subfilters: new Set(subfilters),
      },
      () => {
        this.props.onToggle(this.props.data, subfilters, e);
      }
    );
  };

  render() {
    const {disabled} = this.props;
    return (
      <div>
        {!disabled && (
          <div>
            <BulkFilter>
              <FieldLabel>{t('Filter out legacy browsers')}:</FieldLabel>
              <ButtonBar gap={1}>
                <Button
                  priority="link"
                  borderless
                  onClick={this.handleToggleSubfilters.bind(this, true)}
                >
                  {t('All')}
                </Button>
                <Button
                  priority="link"
                  borderless
                  onClick={this.handleToggleSubfilters.bind(this, false)}
                >
                  {t('None')}
                </Button>
              </ButtonBar>
            </BulkFilter>
            <FieldHelp>
              {t(
                'The browser versions filtered out will be periodically evaluated and updated.'
              )}
            </FieldHelp>
          </div>
        )}

        <FilterGrid>
          {Object.keys(LEGACY_BROWSER_SUBFILTERS)
            .filter(key => {
              if (this.props.hasLegacyBrowserUpdate) {
                if (!LEGACY_BROWSER_SUBFILTERS[key].legacy) {
                  return true;
                }
                return this.state.subfilters.has(key);
              }
              return LEGACY_BROWSER_SUBFILTERS[key].legacy;
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
                    isActive={this.state.subfilters.has(key)}
                    isDisabled={disabled}
                    css={{flexShrink: 0, marginLeft: 6}}
                    toggle={this.handleToggleSubfilters.bind(this, key)}
                    size="lg"
                  />
                </FilterGridItem>
              );
            })}
        </FilterGrid>
      </div>
    );
  }
}

function CustomFilters({project, disabled}: {disabled: boolean; project: Project}) {
  return (
    <Feature
      features="projects:custom-inbound-filters"
      hookName="feature-disabled:custom-inbound-filters"
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
            // XXX: children is set to null as we're doing tricksy things
            // in the renderDisabled prop a few lines higher.
            renderDisabled({
              organization,
              hasFeature,
              children: null,
              ...featureProps,
            })}

          {customFilterFields.map(field => (
            <FieldFromConfig
              key={field.name}
              field={field}
              disabled={disabled || !hasFeature}
            />
          ))}

          {hasFeature && project.options?.['filters:error_messages'] && (
            <PanelAlert type="warning" data-test-id="error-message-disclaimer">
              {t(
                "Minidumps, errors in the minified production build of React, and Internet Explorer's i18n errors cannot be filtered by message."
              )}
            </PanelAlert>
          )}
        </Fragment>
      )}
    </Feature>
  );
}

type Props = {
  features: Set<string>;
  params: {
    projectId: string;
  };
  project: Project;
};

type Filter = {
  active: boolean | string[];
  description: string;
  hello: string;
  id: string;
  name: string;
};

export function ProjectFiltersSettings({project, params, features}: Props) {
  const organization = useOrganization();
  const {projectId: projectSlug} = params;

  const hasLegacyBrowserUpdate = organization.features.includes('legacy-browser-update');

  const projectEndpoint = `/projects/${organization.slug}/${projectSlug}/`;
  const filtersEndpoint = `${projectEndpoint}filters/`;

  const {
    data: filterListData,
    isLoading,
    isError,
    refetch,
  } = useApiQuery<Filter[]>([`/projects/${organization.slug}/${projectSlug}/filters/`], {
    staleTime: 0,
    cacheTime: 0,
  });

  const filterList = filterListData ?? [];

  const handleLegacyChange = useCallback(
    ({
      onChange,
      onBlur,
      event,
      subfilters,
    }: {
      event: React.MouseEvent;
      onBlur: FormFieldProps['onBlur'];
      onChange: FormFieldProps['onChange'];
      subfilters: RowState['subfilters'];
    }) => {
      onChange?.(subfilters, event);
      onBlur?.(subfilters, event);
    },
    []
  );

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <Access access={['project:write']} project={project}>
      {({hasAccess}) => (
        <Fragment>
          <Panel>
            <PanelHeader>{t('Filters')}</PanelHeader>
            <PanelBody>
              {filterList.map(filter => {
                const fieldProps = {
                  name: filter.id,
                  disabled: !hasAccess,
                  ...filterDescriptions[filter.id],
                };

                // Note by default, forms generate data in the format of:
                // { [fieldName]: [value] }
                // Endpoints for these filters expect data to be:
                // { 'active': [value] }
                return (
                  <PanelItem key={filter.id} noPadding>
                    <NestedForm
                      apiMethod="PUT"
                      apiEndpoint={`${filtersEndpoint}${filter.id}/`}
                      initialData={{[filter.id]: filter.active}}
                      saveOnBlur
                      onFieldChange={(name, value) => {
                        trackAnalytics('settings.inbound_filter_updated', {
                          organization,
                          project_id: parseInt(project.id as string, 10),
                          filter: name,
                          new_state:
                            filter.id === 'legacy-browsers' && value instanceof Set
                              ? [...value].sort().join(',')
                              : value
                                ? 'enabled'
                                : 'disabled',
                        });
                      }}
                    >
                      {filter.id !== 'legacy-browsers' ? (
                        <FieldFromConfig
                          key={filter.id}
                          getData={data => ({active: data[filter.id]})}
                          field={{
                            type: 'boolean',
                            ...fieldProps,
                          }}
                        />
                      ) : (
                        <FormField
                          inline={false}
                          {...fieldProps}
                          getData={data => ({subfilters: [...data[filter.id]]})}
                        >
                          {({onChange, onBlur}) => (
                            <LegacyBrowserFilterRow
                              key={filter.id}
                              data={filter}
                              disabled={!hasAccess}
                              onToggle={(_data, subfilters, event) =>
                                handleLegacyChange({onChange, onBlur, event, subfilters})
                              }
                              hasLegacyBrowserUpdate={hasLegacyBrowserUpdate}
                            />
                          )}
                        </FormField>
                      )}
                    </NestedForm>
                  </PanelItem>
                );
              })}
              <PanelItem noPadding>
                <NestedForm
                  apiMethod="PUT"
                  apiEndpoint={projectEndpoint}
                  initialData={{
                    'filters:react-hydration-errors':
                      project.options?.['filters:react-hydration-errors'],
                  }}
                  saveOnBlur
                  onFieldChange={(name, value) => {
                    trackAnalytics('settings.inbound_filter_updated', {
                      organization,
                      project_id: parseInt(project.id as string, 10),
                      filter: name,
                      new_state: value ? 'enabled' : 'disabled',
                    });
                  }}
                  onSubmitSuccess={(
                    response // This will update our project context
                  ) => ProjectsStore.onUpdateSuccess(response)}
                >
                  <FieldFromConfig
                    getData={getOptionsData}
                    field={{
                      type: 'boolean',
                      name: 'filters:react-hydration-errors',
                      label: t('Filter out hydration errors'),
                      help: t(
                        'React falls back to do a full re-render on a page and these errors are often not actionable.'
                      ),
                      disabled: !hasAccess,
                    }}
                  />
                </NestedForm>
              </PanelItem>
              <PanelItem noPadding>
                <NestedForm
                  apiMethod="PUT"
                  apiEndpoint={projectEndpoint}
                  initialData={{
                    'filters:chunk-load-error':
                      project.options?.['filters:chunk-load-error'],
                  }}
                  saveOnBlur
                  onFieldChange={(name, value) => {
                    trackAnalytics('settings.inbound_filter_updated', {
                      organization,
                      project_id: parseInt(project.id as string, 10),
                      filter: name,
                      new_state: value ? 'enabled' : 'disabled',
                    });
                  }}
                  onSubmitSuccess={(
                    response // This will update our project context
                  ) => ProjectsStore.onUpdateSuccess(response)}
                >
                  <FieldFromConfig
                    getData={getOptionsData}
                    field={{
                      type: 'boolean',
                      name: 'filters:chunk-load-error',
                      label: t('Filter out ChunkLoadError(s)'),
                      help: t(
                        "ChunkLoadErrors can happen in Webpack-powered applications when code chunks can't be found on the server. This often occurs during a redeploy of the website while users have the old page open. A page refresh usually resolves the issue."
                      ),
                      disabled: !hasAccess,
                    }}
                  />
                </NestedForm>
              </PanelItem>
            </PanelBody>
          </Panel>

          <Form
            apiMethod="PUT"
            apiEndpoint={projectEndpoint}
            initialData={project.options}
            saveOnBlur
            onSubmitSuccess={response =>
              // This will update our project context
              ProjectsStore.onUpdateSuccess(response)
            }
          >
            <JsonForm
              features={features}
              forms={filterGroups}
              disabled={!hasAccess}
              renderFooter={() => (
                <CustomFilters disabled={!hasAccess} project={project} />
              )}
            />
          </Form>
        </Fragment>
      )}
    </Access>
  );
}

// TODO(ts): Understand why styled is not correctly inheriting props here
const NestedForm = styled(Form)<FormProps>`
  flex: 1;
`;

const FilterGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(1.5)};
  margin-top: ${space(2)};
`;

const FilterGridItem = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  gap: ${space(1)};
  align-items: center;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1.5)};
`;

const FilterGridIcon = styled('img')`
  width: 38px;
  height: 38px;
`;

const FilterTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: bold;
  white-space: nowrap;
`;

const FilterDescription = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  white-space: nowrap;
`;

const BulkFilter = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;
