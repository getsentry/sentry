import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {Project} from 'app/types';
import {
  Panel,
  PanelAlert,
  PanelBody,
  PanelHeader,
  PanelItem,
} from 'app/components/panels';
import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import AsyncComponent from 'app/components/asyncComponent';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';
import FormField from 'app/views/settings/components/forms/formField';
import HookStore from 'app/stores/hookStore';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import Switch from 'app/components/switch';
import filterGroups, {customFilterFields} from 'app/data/forms/inboundFilters';

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
  loading: boolean;
  error: boolean | Error;
  subfilters: Set<string>;
};

class LegacyBrowserFilterRow extends React.Component<RowProps, RowState> {
  static propTypes = {
    data: PropTypes.object.isRequired,
    onToggle: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
  };

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
  project: Project;
  features: Set<string>;
  params: {
    orgId: string;
    projectId: string;
  };
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
    return [
      ['filterList', `/projects/${orgId}/${projectId}/filters/`],
      ['project', `/projects/${orgId}/${projectId}/`],
    ];
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.project !== this.props.project) {
      this.reloadData();
    }
    super.componentDidUpdate(prevProps, prevState);
  }

  handleLegacyChange = (
    onChange: FormFieldProps['onChange'],
    onBlur: FormFieldProps['onBlur'],
    _filter,
    subfilters: RowState['subfilters'],
    e
  ) => {
    onChange?.(subfilters, e);
    onBlur?.(subfilters, e);
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

  renderCustomFilters = (disabled: boolean) => () => (
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
        </React.Fragment>
      )}
    </Feature>
  );

  renderBody() {
    const {features, params} = this.props;
    const {orgId, projectId} = params;
    const {project} = this.state;

    if (!project) {
      return null;
    }
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
                    <PanelItem key={filter.id} p={0}>
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
              initialData={this.state.project.options}
              saveOnBlur
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

const NestedForm = styled(Form)`
  flex: 1;
`;

const FilterGrid = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;

const FilterGridItem = styled('div')`
  display: flex;
  align-items: center;
  background: ${p => p.theme.gray100};
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
  color: ${p => p.theme.gray600};
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
