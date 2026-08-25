import {Component} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {DiscoverButton} from 'sentry/components/discoverButton';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {Panel} from 'sentry/components/panels/panel';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconSettings} from 'sentry/icons';
import {IconTelescope} from 'sentry/icons/iconTelescope';
import {t, tct} from 'sentry/locale';
import type {DataCategoryInfo} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {ProjectSummaryWithOptions} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';
import {decodeScalar} from 'sentry/utils/queryString';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {withOrganization} from 'sentry/utils/withOrganization';
import {makeDiscoverPathname} from 'sentry/views/discover/pathnames';
import {getDiscoverDeprecation} from 'sentry/views/discover/utils';
import {
  formatUsageWithUnits,
  getFormatUsageOptions,
} from 'sentry/views/organizationStats/utils';

import {withSubscription} from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {
  SpendVisibilityEvents,
  trackSpendVisibilityAnaltyics,
} from 'getsentry/utils/trackSpendVisibilityAnalytics';
import {
  SPIKE_PROTECTION_DOCS_LINK,
  SPIKE_PROTECTION_ERROR_MESSAGE,
} from 'getsentry/views/spikeProtection/constants';
import {SpikeProtectionTimeDetails} from 'getsentry/views/spikeProtection/spikeProtectionTimeDetails';
import type {SpikeDetails} from 'getsentry/views/spikeProtection/types';

import {isSpikeProtectionEnabled} from './spikeProtectionProjectToggle';

type Props = {
  dataCategoryInfo: DataCategoryInfo;
  onEnableSpikeProtection: () => void;
  organization: Organization;
  project: ProjectSummaryWithOptions;
  spikes: SpikeDetails[];
  subscription: Subscription;
  isLoading?: boolean;
};

const SPIKE_COLUMNS: TableColumnConfig[] = [
  {key: 'time', width: 'auto'},
  {key: 'threshold', width: 'auto'},
  {key: 'duration', width: 'auto'},
  {key: 'dropped', width: 'auto'},
  {key: 'actions', width: 'auto'},
];

function EnableSpikeProtectionButton({
  onEnableSpikeProtection,
  project,
  subscription,
  ...props
}: {
  onEnableSpikeProtection: () => void;
  project: ProjectSummaryWithOptions;
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
    return (
      <SimpleTable.Row key={spike.start}>
        <SimpleTable.RowCell>
          <SpikeProtectionTimeDetails spike={spike} />
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          {defined(spike.threshold)
            ? formatUsageWithUnits(
                spike.threshold,
                dataCategoryInfo.plural,
                getFormatUsageOptions(dataCategoryInfo.plural)
              )
            : '-'}
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          {duration ? getExactDuration(duration, true) : t('Ongoing')}
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          {spike.dropped
            ? formatUsageWithUnits(
                spike.dropped,
                dataCategoryInfo.plural,
                getFormatUsageOptions(dataCategoryInfo.plural)
              )
            : '-'}
        </SimpleTable.RowCell>
        <SimpleTable.RowCell justify="end">
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
              pathname: makeDiscoverPathname({
                organization,
                path: '/homepage/',
              }),
              query: {
                project: [project.id],
                start: decodeScalar(spike.start),
                end: decodeScalar(spike.end),
              },
            }}
          >
            {getDiscoverDeprecation(organization)
              ? t('Open in Explore')
              : t('Open in Discover')}
          </DiscoverButton>
        </SimpleTable.RowCell>
      </SimpleTable.Row>
    );
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
      <SimpleTable
        columns={SPIKE_COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            {this.headers.map((header, i) => (
              <SimpleTable.HeaderCell key={i}>{header}</SimpleTable.HeaderCell>
            ))}
          </SimpleTable.HeaderRow>
        }
      >
        {spikes.map(spike => this.renderSpikeRow(spike))}
      </SimpleTable>
    );
  }

  render() {
    const {organization} = this.props;
    return (
      <div data-test-id="spike-protection-history-table">
        <Flex align="center" marginBottom="xl" gap="md">
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
            to={`/settings/${organization.slug}/spike-protection/`}
          >
            {t('Spike Protection Settings')}
          </LinkButton>
        </Flex>
        {this.renderTable()}
      </div>
    );
  }
}

export default withSubscription(withOrganization(SpikeProtectionHistoryTable));

const Title = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.font.size.lg};
  color: ${p => p.theme.colors.gray500};
  display: flex;
  flex: 1;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

const EmptySpikeHistory = styled(Panel)`
  width: 100%;
  display: flex;
  flex-direction: column;
  text-align: center;
  padding: ${p => p.theme.space['3xl']} ${p => p.theme.space.xl};
  b {
    font-size: ${p => p.theme.font.size.lg};
    margin-bottom: ${p => p.theme.space.md};
  }
  p:last-child {
    margin: 0;
  }
`;
