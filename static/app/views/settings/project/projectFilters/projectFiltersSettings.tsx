import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import iconAndroid from 'sentry-logos/logo-android.svg';
import iconIe from 'sentry-logos/logo-ie.svg';
import iconOpera from 'sentry-logos/logo-opera.svg';
import iconSafari from 'sentry-logos/logo-safari.svg';

import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import AsyncComponent from 'sentry/components/asyncComponent';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import Form, {FormProps} from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import JsonForm from 'sentry/components/forms/jsonForm';
import {
  Panel,
  PanelAlert,
  PanelBody,
  PanelHeader,
  PanelItem,
} from 'sentry/components/panels';
import Switch from 'sentry/components/switchButton';
import filterGroups, {
  customFilterFields,
  getOptionsData,
} from 'sentry/data/forms/inboundFilters';
import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';

const LEGACY_BROWSER_SUBFILTERS = {
  ie_pre_9: {
    icon: iconIe,
    helpText: 'Version 8 and lower',
    title: 'Internet Explorer',
  },
  ie9: {
    icon: iconIe,
    helpText: 'Version 9',
    title: 'Internet Explorer',
  },
  ie10: {
    icon: iconIe,
    helpText: 'Version 10',
    title: 'Internet Explorer',
  },
  ie11: {
    icon: iconIe,
    helpText: 'Version 11',
    title: 'Internet Explorer',
  },
  safari_pre_6: {
    icon: iconSafari,
    helpText: 'Version 5 and lower',
    title: 'Safari',
  },
  opera_pre_15: {
    icon: iconOpera,
    helpText: 'Version 14 and lower',
    title: 'Opera',
  },
  opera_mini_pre_8: {
    icon: iconOpera,
    helpText: 'Version 8 and lower',
    title: 'Opera Mini',
  },
  android_pre_4: {
    icon: iconAndroid,
    helpText: 'Version 3 and lower',
    title: 'Android',
  },
};

const LEGACY_BROWSER_KEYS = Object.keys(LEGACY_BROWSER_SUBFILTERS);

type FormFieldProps = React.ComponentProps<typeof FormField>;

type RowProps = {
  data: {
    active: string[] | boolean;
  };
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
      initialSubfilters = new Set(LEGACY_BROWSER_KEYS);
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
      subfilters = new Set(LEGACY_BROWSER_KEYS);
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
          <BulkFilter>
            <BulkFilterLabel>{t('Filter')}:</BulkFilterLabel>
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
        )}

        <FilterGrid>
          {LEGACY_BROWSER_KEYS.map(key => {
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

type Props = {
  features: Set<string>;
  organization: Organization;
  params: {
    projectId: string;
  };
  project: Project;
};

type State = {
  hooksDisabled: ReturnType<(typeof HookStore)['get']>;
} & AsyncComponent['state'];

class ProjectFiltersSettings extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      hooksDisabled: HookStore.get('feature-disabled:custom-inbound-filters'),
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    const {projectId} = this.props.params;
    return [['filterList', `/projects/${organization.slug}/${projectId}/filters/`]];
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.project.slug !== this.props.project.slug) {
      this.reloadData();
    }
    super.componentDidUpdate(prevProps, prevState);
  }

  handleLegacyChange = (
    onChange: FormFieldProps['onChange'],
    onBlur: FormFieldProps['onBlur'],
    _filter,
    subfilters: RowState['subfilters'],
    e: React.MouseEvent
  ) => {
    onChange?.(subfilters, e);
    onBlur?.(subfilters, e);
  };

  handleSubmit = (response: Project) => {
    // This will update our project context
    ProjectsStore.onUpdateSuccess(response);
  };

  renderDisabledCustomFilters = p => (
    <FeatureDisabled
      featureName={t('Custom Inbound Filters')}
      features={p.features}
      alert={PanelAlert}
      message={t(
        'Release and Error Message filtering are not enabled on your Sentry installation'
      )}
    />
  );

  renderCustomFilters = (disabled: boolean) => () =>
    (
      <Feature
        features={['projects:custom-inbound-filters']}
        hookName="feature-disabled:custom-inbound-filters"
        project={this.props.project}
        renderDisabled={({children, ...props}) => {
          if (typeof children === 'function') {
            return children({...props, renderDisabled: this.renderDisabledCustomFilters});
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
              renderDisabled({organization, hasFeature, children: null, ...featureProps})}

            {customFilterFields.map(field => (
              <FieldFromConfig
                key={field.name}
                field={field}
                disabled={disabled || !hasFeature}
              />
            ))}

            {hasFeature && this.props.project.options?.['filters:error_messages'] && (
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

  renderBody() {
    const {features, organization, params, project} = this.props;
    const {projectId} = params;

    const projectEndpoint = `/projects/${organization.slug}/${projectId}/`;
    const filtersEndpoint = `${projectEndpoint}filters/`;

    return (
      <Access access={['project:write']}>
        {({hasAccess}) => (
          <Fragment>
            <Panel>
              <PanelHeader>{t('Filters')}</PanelHeader>
              <PanelBody>
                {this.state.filterList.map(filter => {
                  const fieldProps = {
                    name: filter.id,
                    label: filter.name,
                    help: filter.description,
                    disabled: !hasAccess,
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
                                onToggle={this.handleLegacyChange.bind(
                                  this,
                                  onChange,
                                  onBlur
                                )}
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
                    onSubmitSuccess={this.handleSubmit}
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
              </PanelBody>
            </Panel>

            <Form
              apiMethod="PUT"
              apiEndpoint={projectEndpoint}
              initialData={project.options}
              saveOnBlur
              onSubmitSuccess={this.handleSubmit}
            >
              <JsonForm
                features={features}
                forms={filterGroups}
                disabled={!hasAccess}
                renderFooter={this.renderCustomFilters(!hasAccess)}
              />
            </Form>
          </Fragment>
        )}
      </Access>
    );
  }
}

export default ProjectFiltersSettings;

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

const BulkFilterLabel = styled('span')`
  font-weight: bold;
  margin-right: ${space(0.75)};
`;
