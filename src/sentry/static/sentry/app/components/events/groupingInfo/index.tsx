import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import AsyncComponent from 'app/components/asyncComponent';
import EventDataSection from 'app/components/events/eventDataSection';
import {t} from 'app/locale';
import withOrganization from 'app/utils/withOrganization';
import {Organization, Event, EventGroupInfo} from 'app/types';

import GroupVariant from './groupingVariant';
import GroupingConfigSelect from './groupingConfigSelect';

type Props = AsyncComponent['props'] & {
  api: Client;
  organization: Organization;
  projectId: string;
  event: Event;
  showSelector: boolean;
};

type State = AsyncComponent['state'] & {
  isOpen: boolean;
  configOverride: string | null;
  groupInfo: EventGroupInfo;
};

class EventGroupingInfo extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, event, projectId} = this.props;

    let path = `/projects/${organization.slug}/${projectId}/events/${event.id}/grouping-info/`;
    if (this.state?.configOverride) {
      path = `${path}?config=${this.state.configOverride}`;
    }

    return [['groupInfo', path]];
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      isOpen: false,
      configOverride: null,
    };
  }

  toggle = () => {
    this.setState(state => ({
      isOpen: !state.isOpen,
      configOverride: state.isOpen ? null : state.configOverride,
    }));
  };

  handleConfigSelect = selection => {
    this.setState({configOverride: selection.value}, () => this.reloadData());
  };

  renderGroupInfoSummary() {
    const {groupInfo} = this.state;

    if (groupInfo === null) {
      return null;
    }

    const groupedBy = Object.values(groupInfo)
      .filter(variant => variant.hash !== null)
      .map(variant => variant.description)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .join(', ');

    return <small>{`(${t('grouped by')} ${groupedBy || t('nothing')})`}</small>;
  }

  renderGroupConfigSelect() {
    const {configOverride} = this.state;
    const {event} = this.props;

    const configId = configOverride ?? event.groupingConfig.id;

    // TODO(grouping): style
    return (
      <div style={{float: 'right'}}>
        <GroupingConfigSelect
          eventConfigId={event.groupingConfig.id}
          configId={configId}
          onSelect={this.handleConfigSelect}
        />
      </div>
    );
  }

  renderGroupInfo() {
    const {groupInfo} = this.state;
    const {showSelector} = this.props;

    const variants = Object.values(groupInfo).sort((a, b) =>
      a.hash && !b.hash
        ? -1
        : a.description.toLowerCase().localeCompare(b.description.toLowerCase())
    );

    return (
      <GroupVariantList>
        {showSelector && this.renderGroupConfigSelect()}

        {variants.map(variant => (
          <GroupVariant variant={variant} key={variant.key} />
        ))}
      </GroupVariantList>
    );
  }

  renderBody() {
    const {isOpen} = this.state;

    const title = (
      <React.Fragment>
        {t('Event Grouping Information')}
        {!isOpen && this.renderGroupInfoSummary()}
      </React.Fragment>
    );

    const actions = (
      <Toggle onClick={this.toggle}>
        {isOpen ? t('Hide Details') : t('Show Details')}
      </Toggle>
    );

    // TODO(grouping): className
    return (
      <EventDataSection
        type="grouping-info"
        className="grouping-info"
        title={title}
        actions={actions}
      >
        {isOpen && this.renderGroupInfo()}
      </EventDataSection>
    );
  }
}

export const GroupingConfigItem = styled(({hidden: _h, active: _a, ...props}) => (
  <code {...props} />
))`
  opacity: ${p => (p.hidden ? 0.5 : null)};
  font-weight: ${p => (p.active ? 'bold' : null)};
`;

const GroupVariantList = styled('ul')`
  padding: 0;
  margin: 0;
  list-style: none;
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 18px;
`;

const Toggle = styled('a')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 700;
  color: ${p => p.theme.foreground};
`;

export default withOrganization(EventGroupingInfo);
