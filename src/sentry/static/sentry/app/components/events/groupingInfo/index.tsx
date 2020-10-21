import { Fragment } from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import EventDataSection from 'app/components/events/eventDataSection';
import {t} from 'app/locale';
import withOrganization from 'app/utils/withOrganization';
import {Organization, Event, EventGroupInfo} from 'app/types';
import space from 'app/styles/space';
import Button from 'app/components/button';
import LoadingIndicator from 'app/components/loadingIndicator';

import GroupVariant from './groupingVariant';
import GroupingConfigSelect from './groupingConfigSelect';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projectId: string;
  event: Event;
  showGroupingConfig: boolean;
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

    if (!groupInfo) {
      return null;
    }

    const groupedBy = Object.values(groupInfo)
      .filter(variant => variant.hash !== null && variant.description !== null)
      .map(variant => variant.description)
      .sort((a, b) => a!.toLowerCase().localeCompare(b!.toLowerCase()))
      .join(', ');

    return (
      <SummaryGroupedBy data-test-id="loaded-grouping-info">{`(${t('grouped by')} ${
        groupedBy || t('nothing')
      })`}</SummaryGroupedBy>
    );
  }

  renderGroupConfigSelect() {
    const {configOverride} = this.state;
    const {event} = this.props;

    const configId = configOverride ?? event.groupingConfig.id;

    return (
      <GroupConfigWrapper>
        <GroupingConfigSelect
          eventConfigId={event.groupingConfig.id}
          configId={configId}
          onSelect={this.handleConfigSelect}
        />
      </GroupConfigWrapper>
    );
  }

  renderGroupInfo() {
    const {groupInfo, loading} = this.state;
    const {showGroupingConfig} = this.props;

    const variants = groupInfo
      ? Object.values(groupInfo).sort((a, b) =>
          a.hash && !b.hash
            ? -1
            : a.description
                ?.toLowerCase()
                .localeCompare(b.description?.toLowerCase() ?? '') ?? 1
        )
      : [];

    return (
      <Fragment>
        {showGroupingConfig && this.renderGroupConfigSelect()}

        {loading ? (
          <LoadingIndicator />
        ) : (
          variants.map((variant, index) => (
            <Fragment key={variant.key}>
              <GroupVariant variant={variant} showGroupingConfig={showGroupingConfig} />
              {index < variants.length - 1 && <VariantDivider />}
            </Fragment>
          ))
        )}
      </Fragment>
    );
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {isOpen} = this.state;

    const title = (
      <Fragment>
        {t('Event Grouping Information')}
        {!isOpen && this.renderGroupInfoSummary()}
      </Fragment>
    );

    const actions = (
      <ToggleButton onClick={this.toggle} priority="link">
        {isOpen ? t('Hide Details') : t('Show Details')}
      </ToggleButton>
    );

    return (
      <EventDataSection type="grouping-info" title={title} actions={actions}>
        {isOpen && this.renderGroupInfo()}
      </EventDataSection>
    );
  }
}

const SummaryGroupedBy = styled('small')`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
    margin: 0 !important;
  }
`;

const ToggleButton = styled(Button)`
  font-weight: 700;
  color: ${p => p.theme.gray600};
  &:hover,
  &:focus {
    color: ${p => p.theme.gray700};
  }
`;

const GroupConfigWrapper = styled('div')`
  margin-bottom: ${space(1.5)};
  margin-top: -${space(1)};
`;

export const GroupingConfigItem = styled('span')<{
  isHidden?: boolean;
  isActive?: boolean;
}>`
  font-family: ${p => p.theme.text.familyMono};
  opacity: ${p => (p.isHidden ? 0.5 : null)};
  font-weight: ${p => (p.isActive ? 'bold' : null)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const VariantDivider = styled('hr')`
  padding-top: ${space(1)};
`;

export default withOrganization(EventGroupingInfo);
