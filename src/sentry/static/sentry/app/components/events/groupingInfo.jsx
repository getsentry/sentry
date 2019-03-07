import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {isObject} from 'lodash';

import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';
import {t} from 'app/locale';
import KeyValueList from 'app/components/events/interfaces/keyValueList';

import withApi from 'app/utils/withApi';

const StyledGroupVariantList = styled('ul')`
  padding: 0;
  margin: 0;
  list-style: none;
  font-size: 14px;
  line-height: 18px;
`;

const StyledGroupVariantListItem = styled(({contributes, ...props}) => <li {...props} />)`
  padding: 15px 0 20px 0;
  margin-top: 15px;
  border-top: 1px solid ${p => p.theme.borderLighter};
  ${p => (p.contributes ? '' : 'color:' + p.theme.gray6)};
`;

const StyledGroupVariantTitle = styled('h5')`
  margin: 0 0 10px 0;
  color: inherit !important;
  text-transform: uppercase;
  font-size: 14px;
`;

const StyledGroupingComponentWrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.borderLighter};
  padding: 10px 0 0 0;
  margin-top: -10px;
`;

const StyledGroupingComponentList = styled('ul')`
  padding: 0;
  margin: 0;
  list-style: none;
`;

const StyledGroupingComponentListItem = styled('li')`
  padding: 0;
  margin: 2px 0 1px 13px;
`;

const StyledGroupingComponent = styled(({contributes, ...props}) => <div {...props} />)`
  ${p => (p.contributes ? '' : 'color:' + p.theme.gray6)};
`;

const StyledGroupingValue = styled('code')`
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
        rv = <StyledGroupingValue>{JSON.stringify(value, null, 2)}</StyledGroupingValue>;
      }
      return (
        <StyledGroupingComponentListItem key={idx}>{rv}</StyledGroupingComponentListItem>
      );
    });

    return (
      <StyledGroupingComponent contributes={component.contributes}>
        <span>
          {component.name || component.id}
          {component.hint && <small>{` (${component.hint})`}</small>}
        </span>
        <StyledGroupingComponentList>{children}</StyledGroupingComponentList>
      </StyledGroupingComponent>
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

  toggleNonContributing() {
    this.setState({
      showNonContributing: !this.state.showNonContributing,
    });
  }

  renderVariantDetails() {
    const {variant} = this.props;
    const data = [['Algorithm', variant.type]];
    let component = null;

    if (variant.hash !== null) {
      data.push(['Hash', variant.hash]);
    }
    if (variant.hashMismatch) {
      data.push(['Hash mismatch', 'hashing algorithm changed after event generation']);
    }

    switch (variant.type) {
      case 'component':
        component = variant.component;
        break;
      case 'custom-fingerprint':
        data.push(['Fingerprint values', variant.values]);
        break;
      case 'salted-component':
        data.push(['Fingerprint values', variant.values]);
        component = variant.component;
        break;
      default:
        break;
    }

    return (
      <div>
        <KeyValueList data={data} isContextData />
        {component && (
          <StyledGroupingComponentWrapper>
            {hasNonContributingComponent(component) && (
              <a className="pull-right" onClick={() => this.toggleNonContributing()}>
                {this.state.showNonContributing
                  ? t('hide non contributing values')
                  : t('show non contributing values')}
              </a>
            )}
            <GroupingComponent
              component={component}
              showNonContributing={this.state.showNonContributing}
            />
          </StyledGroupingComponentWrapper>
        )}
      </div>
    );
  }

  render() {
    const {variant} = this.props;
    return (
      <StyledGroupVariantListItem contributes={variant.hash !== null}>
        <StyledGroupVariantTitle>{`by ${variant.description}`}</StyledGroupVariantTitle>
        {this.renderVariantDetails()}
      </StyledGroupVariantListItem>
    );
  }
}

class EventGroupingInfo extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      isOpen: false,
      loading: false,
      groupInfo: null,
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (
      this.state.isOpen != nextState.isOpen ||
      this.state.groupInfo !== nextState.groupInfo ||
      this.state.loading !== nextState.loading
    ) {
      return true;
    }
    return this.props.event.id !== nextProps.event.id;
  }

  componentDidUpdate(prevProps) {
    if (this.props.event.id !== prevProps.event.id) {
      this.fetchData();
    }
  }

  toggle = () => {
    this.setState({isOpen: !this.state.isOpen});
  };

  getEndpoint() {
    return `/events/${this.props.event.id}/grouping-info/`;
  }

  fetchData() {
    this.setState({
      loading: true,
    });
    this.props.api.request(this.getEndpoint(), {
      method: 'GET',
      success: data => {
        this.setState({
          error: false,
          loading: false,
          groupInfo: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  }

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

    return (
      <StyledGroupVariantList>
        {variants.map(variant => <GroupVariant variant={variant} key={variant.key} />)}
      </StyledGroupVariantList>
    );
  }

  render() {
    const isOpen = this.state.isOpen;
    return (
      <EventDataSection
        group={this.props.group}
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
          {this.state.loading && <LoadingIndicator />}
          {this.state.error && <LoadingError onRetry={this.fetchData} />}
          {this.state.groupInfo !== null && isOpen && this.renderGroupInfo()}
        </div>
      </EventDataSection>
    );
  }
}

export default withApi(EventGroupingInfo);
