import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {isObject} from 'lodash';
import AsyncComponent from 'app/components/asyncComponent';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import Tooltip from 'app/components/tooltip';

import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import KeyValueList from 'app/components/events/interfaces/keyValueList';

import withOrganization from 'app/utils/withOrganization';

const GroupVariantList = styled('ul')`
  padding: 0;
  margin: 0;
  list-style: none;
  font-size: 14px;
  line-height: 18px;
`;

const GroupVariantListItem = styled(({contributes, ...props}) => <li {...props} />)`
  padding: 15px 0 20px 0;
  margin-top: 15px;
  ${p => (p.contributes ? '' : 'color:' + p.theme.gray6)};
`;

const GroupVariantTitle = styled('h5')`
  margin: 0 0 10px 0;
  color: inherit !important;
  text-transform: uppercase;
  font-size: 14px;
`;

const GroupingComponentBox = styled('div')`
  padding: 10px 0 0 0;
  margin-top: -10px;
`;

const GroupingComponentList = styled('ul')`
  padding: 0;
  margin: 0;
  list-style: none;
`;

const GroupingComponentListItem = styled('li')`
  padding: 0;
  margin: 2px 0 1px 13px;
`;

const GroupingComponentWrapper = styled(({contributes, ...props}) => <div {...props} />)`
  ${p => (p.contributes ? '' : 'color:' + p.theme.gray6)};
`;

const GroupingValue = styled('code')`
  display: inline-block;
  margin: 1px 4px 1px 0;
  font-size: 12px;
  padding: 1px 2px;
  color: inherit;
`;

class GroupingComponent extends React.Component {
  static propTypes = {
    component: PropTypes.object,
    showNonContributing: PropTypes.bool,
  };

  render() {
    const {component} = this.props;

    const children = component.values.map((value, idx) => {
      let rv;
      if (isObject(value)) {
        // no point rendering such nodes at all, we never show them
        if (!value.contributes && !value.hint && value.values.length === 0) {
          return null;
        }
        // non contributing values are otherwise optional
        if (!this.props.showNonContributing && !value.contributes) {
          return null;
        }
        rv = (
          <GroupingComponent
            component={value}
            showNonContributing={this.props.showNonContributing}
          />
        );
      } else {
        rv = <GroupingValue>{JSON.stringify(value, null, 2)}</GroupingValue>;
      }
      return <GroupingComponentListItem key={idx}>{rv}</GroupingComponentListItem>;
    });

    return (
      <GroupingComponentWrapper contributes={component.contributes}>
        <span>
          {component.name || component.id}
          {component.hint && <small>{` (${component.hint})`}</small>}
        </span>
        <GroupingComponentList>{children}</GroupingComponentList>
      </GroupingComponentWrapper>
    );
  }
}

function hasNonContributingComponent(component) {
  if (!component.contributes) {
    return true;
  }
  for (const value of component.values) {
    if (isObject(value) && hasNonContributingComponent(value)) {
      return true;
    }
  }
  return false;
}

class GroupVariant extends React.Component {
  static propTypes = {
    variant: PropTypes.object,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      showNonContributing: false,
    };
  }

  toggleNonContributing = () => {
    this.setState({
      showNonContributing: !this.state.showNonContributing,
    });
  };

  renderVariantDetails() {
    const {variant} = this.props;
    const data = [['Type', variant.type]];
    let component = null;

    if (variant.hash !== null) {
      data.push(['Hash', variant.hash]);
    }
    if (variant.hashMismatch) {
      data.push([
        'Hash mismatch',
        'hashing algorithm produced a hash that does not match the event',
      ]);
    }

    switch (variant.type) {
      case 'component':
        component = variant.component;
        data.push(['Grouping Config', variant.config.id]);
        break;
      case 'custom-fingerprint':
        data.push(['Fingerprint values', variant.values]);
        break;
      case 'salted-component':
        data.push(['Fingerprint values', variant.values]);
        data.push(['Grouping Config', variant.config.id]);
        component = variant.component;
        break;
      default:
        break;
    }

    return (
      <div>
        <KeyValueList data={data} isContextData />
        {component && (
          <GroupingComponentBox>
            {hasNonContributingComponent(component) && (
              <a className="pull-right" onClick={this.toggleNonContributing}>
                {this.state.showNonContributing
                  ? t('hide non contributing values')
                  : t('show non contributing values')}
              </a>
            )}
            <GroupingComponent
              component={component}
              showNonContributing={this.state.showNonContributing}
            />
          </GroupingComponentBox>
        )}
      </div>
    );
  }

  render() {
    const {variant} = this.props;
    return (
      <GroupVariantListItem contributes={variant.hash !== null}>
        <GroupVariantTitle>{`by ${variant.description}`}</GroupVariantTitle>
        {this.renderVariantDetails()}
      </GroupVariantListItem>
    );
  }
}

class GroupingConfigSelect extends AsyncComponent {
  static propTypes = {
    eventConfigId: PropTypes.string,
    configId: PropTypes.string,
  };

  getEndpoints() {
    return [['data', '/grouping-configs/']];
  }

  renderBody() {
    const {configId, eventConfigId, ...props} = this.props;
    props.value = configId;

    function renderIdLabel(id) {
      return <code>{eventConfigId === id ? <strong>{id}</strong> : id}</code>;
    }

    return (
      <DropdownAutoComplete
        {...props}
        alignMenu="left"
        selectedItem={configId}
        items={this.state.data.map(item => {
          return {
            value: item.id,
            label: renderIdLabel(item.id),
          };
        })}
      >
        {({isOpen}) => (
          <Tooltip title="Click here to experiment with other grouping configs">
            <DropdownButton isOpen={isOpen} size="small" style={{fontWeight: 'inherit'}}>
              {renderIdLabel(configId)}
            </DropdownButton>
          </Tooltip>
        )}
      </DropdownAutoComplete>
    );
  }
}

class EventGroupingInfo extends AsyncComponent {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization.isRequired,
    projectId: PropTypes.string.isRequired,
    event: SentryTypes.Event.isRequired,
  };

  getEndpoints() {
    const {organization, event, projectId} = this.props;

    let path = `/projects/${organization.slug}/${projectId}/events/${
      event.id
    }/grouping-info/`;
    if (this.state && this.state.configOverride) {
      path = `${path}?config=${this.state.configOverride}`;
    }
    return [['groupInfo', path]];
  }

  getInitialState() {
    return {
      isOpen: false,
      configOverride: null,
      ...super.getInitialState(),
    };
  }

  toggle = () => {
    if (this.state.isOpen) {
      this.setState({
        isOpen: false,
        configOverride: null,
      });
    } else {
      this.setState({
        isOpen: true,
      });
    }
  };

  renderGroupInfoSummary() {
    if (this.state.groupInfo === null) {
      return null;
    }

    const variants = [];
    for (const key of Object.keys(this.state.groupInfo)) {
      const variant = this.state.groupInfo[key];
      if (variant.hash !== null) {
        variants.push(variant.description);
      }
    }
    variants.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    return (
      <React.Fragment>
        {' '}
        <small>{`(grouped by ${variants.join(', ') || 'nothing'})`}</small>
      </React.Fragment>
    );
  }

  renderGroupInfo() {
    const variants = Object.values(this.state.groupInfo);
    variants.sort((a, b) => {
      if (a.hash && !b.hash) {
        return -1;
      }
      return a.description.toLowerCase().localeCompare(b.description.toLowerCase());
    });

    const eventConfigId = this.props.event.groupingConfig.id;
    let configId = this.state.configOverride || null;
    if (configId === null) {
      configId = eventConfigId;
    }

    return (
      <GroupVariantList>
        <div style={{float: 'right'}}>
          <GroupingConfigSelect
            name="groupingConfig"
            eventConfigId={eventConfigId}
            configId={configId}
            onSelect={selection => {
              this.setState(
                {
                  configOverride: selection.value,
                },
                () => this.reloadData()
              );
            }}
          />
        </div>
        {variants.map(variant => (
          <GroupVariant variant={variant} key={variant.key} />
        ))}
      </GroupVariantList>
    );
  }

  renderBody() {
    const isOpen = this.state.isOpen;
    return (
      <EventDataSection
        event={this.props.event}
        type="grouping-info"
        className="grouping-info"
      >
        <div className="box-header">
          <a className="pull-right grouping-info-toggle" onClick={this.toggle}>
            {isOpen ? t('Hide Details') : t('Show Details')}
          </a>
          <h3>
            {t('Event Grouping Information')}
            {!isOpen && this.renderGroupInfoSummary()}
          </h3>
        </div>
        <div style={{display: isOpen ? 'block' : 'none'}}>
          {this.state.groupInfo !== null && isOpen && this.renderGroupInfo()}
        </div>
      </EventDataSection>
    );
  }
}

export default withOrganization(EventGroupingInfo);
