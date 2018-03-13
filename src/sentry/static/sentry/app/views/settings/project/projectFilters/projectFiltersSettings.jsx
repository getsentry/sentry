import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../../../../locale';
import AsyncComponent from '../../../../components/asyncComponent';
import FieldFromConfig from '../../../settings/components/forms/fieldFromConfig';
import Form from '../../../settings/components/forms/form';
import FormField from '../../../settings/components/forms/formField';
import HookStore from '../../../../stores/hookStore';
import JsonForm from '../../../settings/components/forms/jsonForm';
import Panel from '../../../settings/components/panel';
import PanelBody from '../../../settings/components/panelBody';
import PanelHeader from '../../../settings/components/panelHeader';
import PanelItem from '../../../settings/components/panelItem';
import SentryTypes from '../../../../proptypes';
import Switch from '../../../../components/switch';
import filterGroups, {customFilterFields} from '../../../../data/forms/inboundFilters';

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
  opera_pre_15: {
    icon: 'opera',
    helpText: 'Version 14 and lower',
    title: 'Opera',
  },
  safari_pre_6: {
    icon: 'safari',
    helpText: 'Version 5 and lower',
    title: 'Safari',
  },
  android_pre_4: {
    icon: 'android',
    helpText: 'Version 3 and lower',
    title: 'Android',
  },
};

const LEGACY_BROWSER_KEYS = Object.keys(LEGACY_BROWSER_SUBFILTERS);

class LegacyBrowserFilterRow extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    onToggle: PropTypes.func.isRequired,
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
    return (
      <div>
        <BulkFilter>
          <BulkFilterLabel>{t('Filter')}:</BulkFilterLabel>
          <BulkFilterItem onClick={this.handleToggleSubfilters.bind(this, true)}>
            {t('All')}
          </BulkFilterItem>
          <BulkFilterItem onClick={this.handleToggleSubfilters.bind(this, false)}>
            {t('None')}
          </BulkFilterItem>
        </BulkFilter>

        <FilterGrid>
          {LEGACY_BROWSER_KEYS.map(key => {
            let subfilter = LEGACY_BROWSER_SUBFILTERS[key];
            return (
              <FilterGridItemWrapper key={key}>
                <FilterGridItem>
                  <Flex align="center" flex="1">
                    <FilterGridIcon className={`icon-${subfilter.icon}`} />
                    <div>
                      <FilterTitle>{subfilter.title}</FilterTitle>
                      <FilterDescription>{subfilter.helpText}</FilterDescription>
                    </div>
                  </Flex>

                  <Switch
                    isActive={this.state.subfilters.has(key)}
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

class ProjectFiltersSettings extends AsyncComponent {
  static propTypes = {
    project: SentryTypes.Project,
    organization: SentryTypes.Organization,
    params: PropTypes.object,
    features: PropTypes.object,
  };

  getDefaultState() {
    return {
      hooksDisabled: HookStore.get('project:custom-inbound-filters:disabled'),
    };
  }
  getEndpoints() {
    let {orgId, projectId} = this.props.params;
    return [
      ['filterList', `/projects/${orgId}/${projectId}/filters/`],
      ['project', `/projects/${orgId}/${projectId}/`],
    ];
  }

  handleLegacyChange = (onChange, onBlur, filter, subfilters, e) => {
    onChange(subfilters, e);
    onBlur(subfilters, e);
  };

  renderDisabledFeature(fields) {
    let {project, organization} = this.props;
    return this.state.hooksDisabled.map(hook =>
      hook(organization, project, null, fields)
    );
  }

  renderBody() {
    let {features, params} = this.props;
    let {orgId, projectId} = params;
    let {project} = this.state;

    if (!project) return null;
    let projectEndpoint = `/projects/${orgId}/${projectId}/`;
    let filtersEndpoint = `${projectEndpoint}filters/`;

    return (
      <React.Fragment>
        <Panel>
          <PanelHeader>{t('Filters')}</PanelHeader>
          <PanelBody>
            {this.state.filterList.map((filter, idx) => {
              let fieldProps = {
                name: filter.id,
                label: filter.name,
                help: filter.description,
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
                        getData={data => ({subfilters: data[filter.id]})}
                      >
                        {({onChange, onBlur}) => (
                          <LegacyBrowserFilterRow
                            key={filter.id}
                            data={filter}
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
            renderFooter={() => {
              // Render additional fields that are behind a feature flag
              let customFilters = customFilterFields.map(field => (
                <FieldFromConfig key={field.name} field={field} />
              ));

              return features.has('custom-inbound-filters')
                ? customFilters
                : this.renderDisabledFeature(customFilters);
            }}
          />
        </Form>
      </React.Fragment>
    );
  }
}

export default ProjectFiltersSettings;

const NestedForm = styled(Form)`
  flex: 1;
`;

const FilterGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
`;

const FilterGridItem = styled.div`
  display: flex;
  align-items: center;
  background: ${p => p.theme.whiteDark};
  border-radius: 3px;
  flex: 1;
  padding: 12px;
  height: 100%;
`;

// We want this wrapper to maining 30% width
const FilterGridItemWrapper = styled.div`
  padding: 12px;
  flex: 1;
`;

const FilterGridIcon = styled.div`
  width: 38px;
  height: 38px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 38px 38px;
  margin-right: 6px;
  flex-shrink: 0;
`;

const FilterTitle = styled.div`
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
  white-space: nowrap;
`;

const FilterDescription = styled.div`
  color: ${p => p.theme.gray3};
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
`;

const BulkFilter = styled.div`
  text-align: right;
  padding: 0 12px;
`;

const BulkFilterLabel = styled.span`
  font-weight: bold;
  margin-right: 6px;
`;

const BulkFilterItem = styled.a`
  border-right: 1px solid #f1f2f3;
  margin-right: 6px;
  padding-right: 6px;

  &:last-child {
    border-right: none;
    margin-right: 0;
  }
`;
