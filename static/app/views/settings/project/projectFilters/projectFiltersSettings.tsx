import * as React from 'react';
import styled from '@emotion/styled';

import ProjectActions from 'sentry/actions/projectActions';
import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import AsyncComponent from 'sentry/components/asyncComponent';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import Form from 'sentry/components/forms/form';
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
import filterGroups, {customFilterFields} from 'sentry/data/forms/inboundFilters';
import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import {Project} from 'sentry/types';

const LEGACY_BROWSER_SUBFILTERS = {
  ie_pre_9: {
    icon: 'internet-explorer',
    helpText: 'Version 8 and lower',
    title: 'Internet Explorer',
  },
  ie9: {
    icon: 'internet-explorer',
    helpText: 'Version 9',
    title: 'Internet Explorer',
  },
  ie10: {
    icon: 'internet-explorer',
    helpText: 'Version 10',
    title: 'Internet Explorer',
  },
  ie11: {
    icon: 'internet-explorer',
    helpText: 'Version 11',
    title: 'Internet Explorer',
  },
  safari_pre_6: {
    icon: 'safari',
    helpText: 'Version 5 and lower',
    title: 'Safari',
  },
  opera_pre_15: {
    icon: 'opera',
    helpText: 'Version 14 and lower',
    title: 'Opera',
  },
  opera_mini_pre_8: {
    icon: 'opera',
    helpText: 'Version 8 and lower',
    title: 'Opera Mini',
  },
  android_pre_4: {
    icon: 'android',
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

class LegacyBrowserFilterRow extends React.Component<RowProps, RowState> {
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
            <BulkFilterItem onClick={this.handleToggleSubfilters.bind(this, true)}>
              {t('All')}
            </BulkFilterItem>
            <BulkFilterItem onClick={this.handleToggleSubfilters.bind(this, false)}>
              {t('None')}
            </BulkFilterItem>
          </BulkFilter>
        )}

        <FilterGrid>
          {LEGACY_BROWSER_KEYS.map(key => {
            const subfilter = LEGACY_BROWSER_SUBFILTERS[key];
            return (
              <FilterGridItemWrapper key={key}>
                <FilterGridItem>
                  <FilterItem>
                    <FilterGridIcon className={`icon-${subfilter.icon}`} />
                    <div>
                      <FilterTitle>{subfilter.title}</FilterTitle>
                      <FilterDescription>{subfilter.helpText}</FilterDescription>
                    </div>
                  </FilterItem>

                  <Switch
                    isActive={this.state.subfilters.has(key)}
                    isDisabled={disabled}
                    css={{flexShrink: 0, marginLeft: 6}}
                    toggle={this.handleToggleSubfilters.bind(this, key)}
                    size="lg"
                  />
                </FilterGridItem>
              </FilterGridItemWrapper>
            );
          })}
        </FilterGrid>
      </div>
    );
  }
}

type Props = {
  features: Set<string>;
  params: {
    orgId: string;
    projectId: string;
  };
  project: Project;
};

type State = {
  hooksDisabled: ReturnType<typeof HookStore['get']>;
} & AsyncComponent['state'];

class ProjectFiltersSettings extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      hooksDisabled: HookStore.get('feature-disabled:custom-inbound-filters'),
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId, projectId} = this.props.params;
    return [['filterList', `/projects/${orgId}/${projectId}/filters/`]];
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
    ProjectActions.updateSuccess(response);
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
        renderDisabled={({children, ...props}) => {
          if (typeof children === 'function') {
            return children({...props, renderDisabled: this.renderDisabledCustomFilters});
          }
          return null;
        }}
      >
        {({hasFeature, organization, renderDisabled, ...featureProps}) => (
          <React.Fragment>
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
          </React.Fragment>
        )}
      </Feature>
    );

  renderBody() {
    const {features, params, project} = this.props;
    const {orgId, projectId} = params;

    const projectEndpoint = `/projects/${orgId}/${projectId}/`;
    const filtersEndpoint = `${projectEndpoint}filters/`;

    return (
      <Access access={['project:write']}>
        {({hasAccess}) => (
          <React.Fragment>
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
          </React.Fragment>
        )}
      </Access>
    );
  }
}

export default ProjectFiltersSettings;

// TODO(ts): Understand why styled is not correctly inheriting props here
const NestedForm = styled(Form)<Form['props']>`
  flex: 1;
`;

const FilterGrid = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;

const FilterGridItem = styled('div')`
  display: flex;
  align-items: center;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 3px;
  flex: 1;
  padding: 12px;
  height: 100%;
`;

// We want this wrapper to maining 30% width
const FilterGridItemWrapper = styled('div')`
  padding: 12px;
  width: 50%;
`;

const FilterItem = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
`;

const FilterGridIcon = styled('div')`
  width: 38px;
  height: 38px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 38px 38px;
  margin-right: 6px;
  flex-shrink: 0;
`;

const FilterTitle = styled('div')`
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
  white-space: nowrap;
`;

const FilterDescription = styled('div')`
  color: ${p => p.theme.subText};
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
`;

const BulkFilter = styled('div')`
  text-align: right;
  padding: 0 12px;
`;

const BulkFilterLabel = styled('span')`
  font-weight: bold;
  margin-right: 6px;
`;

const BulkFilterItem = styled('a')`
  border-right: 1px solid #f1f2f3;
  margin-right: 6px;
  padding-right: 6px;

  &:last-child {
    border-right: none;
    margin-right: 0;
  }
`;
