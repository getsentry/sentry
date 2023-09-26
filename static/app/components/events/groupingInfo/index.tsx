import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {FeatureFeedback} from 'sentry/components/featureFeedback';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EventGroupInfo, Group, IssueCategory, Organization} from 'sentry/types';
import {Event, EventOccurrence} from 'sentry/types/event';
import withOrganization from 'sentry/utils/withOrganization';

import GroupingConfigSelect from './groupingConfigSelect';
import GroupVariant from './groupingVariant';

const groupingFeedbackTypes = [
  t('Too eager grouping'),
  t('Too specific grouping'),
  t('Other grouping issue'),
];

type Props = DeprecatedAsyncComponent['props'] & {
  event: Event;
  organization: Organization;
  projectSlug: string;
  showGroupingConfig: boolean;
  group?: Group;
};

type State = DeprecatedAsyncComponent['state'] & {
  configOverride: string | null;
  groupInfo: EventGroupInfo;
  isOpen: boolean;
};

class GroupingInfo extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization, event, projectSlug, group} = this.props;

    if (
      event.occurrence &&
      group?.issueCategory === IssueCategory.PERFORMANCE &&
      event.type === 'transaction'
    ) {
      return [];
    }

    let path = `/projects/${organization.slug}/${projectSlug}/events/${event.id}/grouping-info/`;
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

  generatePerformanceGroupInfo() {
    const {group, event} = this.props;
    const {occurrence} = event;
    const {evidenceData} = occurrence as EventOccurrence;

    const variant = group
      ? {
          [group.issueType]: {
            description: t('performance problem'),
            hash: occurrence?.fingerprint[0] || '',
            hasMismatch: false,
            key: group.issueType,
            type: 'performance-problem',
            evidence: {
              op: evidenceData?.op,
              parent_span_ids: evidenceData?.parentSpanIds,
              cause_span_ids: evidenceData?.causeSpanIds,
              offender_span_ids: evidenceData?.offenderSpanIds,
            },
          },
        }
      : null;

    return variant;
  }

  renderGroupInfoSummary() {
    const {groupInfo: _groupInfo} = this.state;
    const {group, event} = this.props;

    const groupInfo =
      group?.issueCategory === IssueCategory.PERFORMANCE &&
      event.occurrence &&
      event.type === 'transaction'
        ? // performance issue grouping details are generated clint-side
          this.generatePerformanceGroupInfo()
        : _groupInfo;

    const groupedBy = groupInfo
      ? Object.values(groupInfo)
          .filter(variant => variant.hash !== null && variant.description !== null)
          .map(variant => variant.description)
          .sort((a, b) => a!.toLowerCase().localeCompare(b!.toLowerCase()))
          .join(', ')
      : t('nothing');

    return (
      <p data-test-id="loaded-grouping-info">
        <strong>{t('Grouped by:')}</strong> {groupedBy}
      </p>
    );
  }

  renderGroupConfigSelect() {
    const {configOverride} = this.state;
    const {event, organization} = this.props;

    if (!event.groupingConfig) {
      return null;
    }

    const configId = configOverride ?? event.groupingConfig?.id;

    return (
      <GroupingConfigSelect
        organizationSlug={organization.slug}
        eventConfigId={event.groupingConfig.id}
        configId={configId}
        onSelect={this.handleConfigSelect}
      />
    );
  }

  renderGroupInfo() {
    const {groupInfo: _groupInfo, loading} = this.state;
    const {event, showGroupingConfig, group} = this.props;

    const groupInfo =
      group?.issueCategory === IssueCategory.PERFORMANCE &&
      event.occurrence &&
      event.type === 'transaction'
        ? this.generatePerformanceGroupInfo()
        : _groupInfo;

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
        <ConfigHeader>
          <div>{showGroupingConfig && this.renderGroupConfigSelect()}</div>
          <FeatureFeedback
            featureName="grouping"
            feedbackTypes={groupingFeedbackTypes}
            buttonProps={{size: 'sm'}}
          />
        </ConfigHeader>

        {loading ? (
          <LoadingIndicator />
        ) : (
          variants.map((variant, index) => (
            <Fragment key={variant.key}>
              <GroupVariant
                event={event}
                variant={variant}
                showGroupingConfig={showGroupingConfig}
              />
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

    return (
      <EventDataSection
        type="grouping-info"
        title={t('Event Grouping Information')}
        actions={
          <ToggleButton onClick={this.toggle} priority="link">
            {isOpen ? t('Hide Details') : t('Show Details')}
          </ToggleButton>
        }
      >
        {isOpen ? this.renderGroupInfo() : this.renderGroupInfoSummary()}
      </EventDataSection>
    );
  }
}

const ConfigHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;

const ToggleButton = styled(Button)`
  font-weight: 700;
  color: ${p => p.theme.subText};
  &:hover,
  &:focus {
    color: ${p => p.theme.textColor};
  }
`;

export const GroupingConfigItem = styled('span')<{
  isActive?: boolean;
  isHidden?: boolean;
}>`
  font-family: ${p => p.theme.text.familyMono};
  opacity: ${p => (p.isHidden ? 0.5 : null)};
  font-weight: ${p => (p.isActive ? 'bold' : null)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const VariantDivider = styled('hr')`
  padding-top: ${space(1)};
  border-top: 1px solid ${p => p.theme.border};
`;

export const EventGroupingInfo = withOrganization(GroupingInfo);
