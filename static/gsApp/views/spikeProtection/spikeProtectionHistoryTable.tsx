import {Component} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button, LinkButton} from 'sentry/components/button';
import DiscoverButton from 'sentry/components/discoverButton';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Panel from 'sentry/components/panels/panel';
import {PanelTable} from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import {IconSettings} from 'sentry/icons';
import {IconTelescope} from 'sentry/icons/iconTelescope';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategoryInfo} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import withOrganization from 'sentry/utils/withOrganization';
import {
  formatUsageWithUnits,
  getFormatUsageOptions,
} from 'sentry/views/organizationStats/utils';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import trackSpendVisibilityAnaltyics, {
  SpendVisibilityEvents,
} from 'getsentry/utils/trackSpendVisibilityAnalytics';
import {
  SPIKE_PROTECTION_DOCS_LINK,
  SPIKE_PROTECTION_ERROR_MESSAGE,
} from 'getsentry/views/spikeProtection/constants';
import SpikeProtectionTimeDetails from 'getsentry/views/spikeProtection/spikeProtectionTimeDetails';
import type {SpikeDetails} from 'getsentry/views/spikeProtection/types';

import {isSpikeProtectionEnabled} from './spikeProtectionProjectToggle';

type Props = {
  dataCategoryInfo: DataCategoryInfo;
  onEnableSpikeProtection: () => void;
  organization: Organization;
  project: Project;
  spikes: SpikeDetails[];
  subscription: Subscription;
  isLoading?: boolean;
};

function EnableSpikeProtectionButton({
  onEnableSpikeProtection,
  project,
  subscription,
  ...props
}: {
  onEnableSpikeProtection: () => void;
  project: Project;
  subscription: Subscription;
}) {
  const api = useApi();
  const organization = useOrganization();
  const endpoint = `/organizations/${organization.slug}/spike-protections/`;

  async function enableSpikeProtection() {
    try {
      await api.requestPromise(endpoint, {
        method: 'POST',
        data: {projects: [project.slug]},
      });
      addSuccessMessage(
        tct('[action] spike protection for [project]', {
          action: t('Enabled'),
          project: project.slug,
        })
      );
      trackSpendVisibilityAnaltyics(SpendVisibilityEvents.SP_PROJECT_TOGGLED, {
        organization,
        subscription,
        project_id: project.id,
        value: true,
        view: 'project_stats',
      });
      onEnableSpikeProtection();
    } catch {
      addErrorMessage(SPIKE_PROTECTION_ERROR_MESSAGE);
    }
  }

  return (
    <Button
      size="sm"
      onClick={() => {
        enableSpikeProtection();
      }}
      {...props}
      data-test-id="enable-sp-button"
    >
      {t('Enable Spike Protection')}
    </Button>
  );
}

class SpikeProtectionHistoryTable extends Component<Props> {
  headers = [
    t('Past Spikes'),
    t('Initial Threshold'),
    t('Duration'),
    t('Events Dropped'),
    null, // Discover Query button
  ];

  renderSpikeRow(spike: SpikeDetails) {
    const {dataCategoryInfo, project, organization, subscription} = this.props;
    // ms -> s, rounds up to get duration in minutes
    // rounding up to match the formatted date and time values
    const millisecondsPerSecond = 1000;
    const secondsPerMinute = 60;
    const duration = spike.end
      ? Math.ceil(
          (new Date(spike.end).valueOf() - new Date(spike.start).valueOf()) /
            (millisecondsPerSecond * secondsPerMinute)
        ) * secondsPerMinute
      : null;
    return [
      <SpikeProtectionTimeDetails spike={spike} key="time" />,
      <StyledCell key="threshold">
        {formatUsageWithUnits(
          spike.threshold,
          dataCategoryInfo.plural,
          getFormatUsageOptions(dataCategoryInfo.plural)
        )}
      </StyledCell>,
      <StyledCell key="duration">
        {duration ? getExactDuration(duration, true) : t('Ongoing')}
      </StyledCell>,
      <StyledCell key="dropped">
        {spike.dropped
          ? formatUsageWithUnits(
              spike.dropped,
              dataCategoryInfo.plural,
              getFormatUsageOptions(dataCategoryInfo.plural)
            )
          : '-'}
      </StyledCell>,
      <StyledCell key="discover-button">
        <DiscoverButton
          icon={<IconTelescope size="sm" />}
          data-test-id="spike-protection-discover-button"
          onClick={() =>
            trackSpendVisibilityAnaltyics(SpendVisibilityEvents.SP_DISCOVER_CLICKED, {
              organization,
              subscription,
              view: 'project_stats',
            })
          }
          to={{
            pathname: `/organizations/${organization.slug}/discover/homepage/`,
            query: {
              project: [project.id],
              start: decodeScalar(spike.start),
              end: decodeScalar(spike.end),
            },
          }}
        >
          {t('Open in Discover')}
        </DiscoverButton>
      </StyledCell>,
    ];
  }

  renderEmptyMessage() {
    const {organization} = this.props;
    return (
      <EmptySpikeHistory data-test-id="spike-history-empty">
        <b>{t('No Significant Spikes')}</b>
        <p>
          {t(
            'Spike Protection is enabled for this project, but there are no significant spikes that lasted 2hrs or longer.'
          )}
          <br />
          {tct('Please see the [auditLogLink: audit log] for all detected spikes.', {
            auditLogLink: <Link to={`/settings/${organization?.slug}/audit-log/`} />,
          })}
        </p>
      </EmptySpikeHistory>
    );
  }

  renderDisabledMessage() {
    const {project, subscription, onEnableSpikeProtection} = this.props;
    return (
      <EmptySpikeHistory data-test-id="spike-history-disabled">
        <b>{t('Spike Protection Disabled')}</b>
        <p>{t('Spike Protection is currently disabled for this project.')}</p>
        <div>
          <EnableSpikeProtectionButton
            project={project}
            subscription={subscription}
            onEnableSpikeProtection={onEnableSpikeProtection}
          />
        </div>
      </EmptySpikeHistory>
    );
  }

  renderTable() {
    const {spikes, project, isLoading} = this.props;

    if (isLoading ?? false) {
      return (
        <Placeholder height="150px">
          <LoadingIndicator mini />
        </Placeholder>
      );
    }

    if (!isSpikeProtectionEnabled(project)) {
      return this.renderDisabledMessage();
    }

    if (spikes.length === 0) {
      return this.renderEmptyMessage();
    }

    return (
      <PanelTable headers={this.headers}>
        {spikes.map(spike => this.renderSpikeRow(spike))}
      </PanelTable>
    );
  }

  render() {
    const {organization} = this.props;
    return (
      <div data-test-id="spike-protection-history-table">
        <SectionHeading>
          <Title>
            {t('Spike Protection')}
            <PageHeadingQuestionTooltip
              docsUrl={SPIKE_PROTECTION_DOCS_LINK}
              title={t(
                'Sentry applies a dynamic rate limit to your account designed to protect you from short-term spikes.'
              )}
            />
          </Title>
          <LinkButton
            size="sm"
            icon={<IconSettings />}
            aria-label={t('Settings')}
            title={t('Go to spike protection settings')}
            to={`/settings/${organization.slug}/spike-protection/`}
          />
        </SectionHeading>
        {this.renderTable()}
      </div>
    );
  }
}

export default withSubscription(withOrganization(SpikeProtectionHistoryTable));

const SectionHeading = styled('div')`
  display: flex;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
  align-items: center;
`;

const Title = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray400};
  display: flex;
  flex: 1;
  align-items: center;
  gap: ${space(0.75)};
`;

const StyledCell = styled('div')`
  display: flex;
  align-items: center;
  &:nth-child(5n) {
    justify-content: end;
  }
`;

const EmptySpikeHistory = styled(Panel)`
  width: 100%;
  display: flex;
  flex-direction: column;
  text-align: center;
  padding: ${space(4)} ${space(2)};
  b {
    font-size: ${p => p.theme.fontSizeLarge};
    margin-bottom: ${space(1)};
  }
  p:last-child {
    margin: 0;
  }
`;
