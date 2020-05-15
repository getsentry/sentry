import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import FeatureBadge from 'app/components/featureBadge';
import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

import GroupVariant from './groupingVariant';
import GroupingConfigSelect from './groupingConfigSelect';
import {Client} from 'app/api';
import {Organization, Event} from 'app/types';

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
    const {groupInfo} = this.state;

    if (groupInfo === null) {
      return null;
    }

    const variants = [];
    for (const key of Object.keys(groupInfo)) {
      const variant = groupInfo[key];
      if (variant.hash !== null) {
        variants.push(variant.description);
      }
    }
    variants.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    return (
      <SubHeading>{`(${t('grouped by')} ${variants.join(', ') ||
        t('nothing')})`}</SubHeading>
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
          {this.props.showSelector && (
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
          )}
        </div>
        {variants.map(variant => (
          <GroupVariant variant={variant} key={variant.key} />
        ))}
      </GroupVariantList>
    );
  }

  renderBody() {
    const isOpen = this.state.isOpen;
    const title = (
      <React.Fragment>
        {t('Event Grouping Information')}
        {!isOpen && this.renderGroupInfoSummary()}
      </React.Fragment>
    );
    const actions = (
      <Toggle onClick={this.toggle}>
        {isOpen ? t('Hide Details') : t('Show Details')} <FeatureBadge type="beta" />
      </Toggle>
    );

    return (
      <EventDataSection
        event={this.props.event}
        type="grouping-info"
        className="grouping-info"
        title={title}
        actions={actions}
      >
        <div style={{display: isOpen ? 'block' : 'none'}}>
          {this.state.groupInfo !== null && isOpen && this.renderGroupInfo()}
        </div>
      </EventDataSection>
    );
  }
}

export const GroupingConfigItem = styled(
  ({hidden: _hidden, active: _active, ...props}) => <code {...props} />
)`
  ${p => (p.hidden ? 'opacity: 0.5;' : '')}
  ${p => (p.active ? 'font-weight: bold;' : '')}
`;

const GroupVariantList = styled('ul')`
  padding: 0;
  margin: 0;
  list-style: none;
  font-size: 14px;
  line-height: 18px;
`;

const Toggle = styled('a')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 700;
  color: ${p => p.theme.foreground};
`;

const SubHeading = styled('small')`
  text-transform: none;
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.foreground};
  margin-left: ${space(1)};
`;

export default withOrganization(EventGroupingInfo);
