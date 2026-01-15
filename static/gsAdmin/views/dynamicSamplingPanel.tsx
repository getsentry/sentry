import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import isEmpty from 'lodash/isEmpty';
import startCase from 'lodash/startCase';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {IconArrow, IconOpen} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

import {SearchInput} from 'admin/components/resultGrid';

type Props = {
  organization?: Organization;
  projectId?: string;
};

type ProjectConfig = {
  configs: Record<string, DSNConfig | null>;
};

type DSNConfig = {
  config?: {
    sampling?: {
      rules: RuleV2[];
    };
  };
};

type RuleV2 = {
  condition: {
    inner: InnerElement[] | InnerElement;
  };
  id: number;
  samplingValue: {
    type: 'factor' | 'sampleRate' | 'reservoir';
    value: number;
    limit?: number;
  };
  type: 'trace' | 'transaction';
  timeRange?: {
    end: string;
    start: string;
  };
};

type InnerElement = {
  value: unknown;
};

enum RuleType {
  BOOST_LOW_VOLUME_PROJECTS = 'Boost Low Volume Projects',
  RECALIBRATION_RULE = 'Recalibration Rule',
  BOOST_ENVIRONMENTS = 'Boost Environments',
  BOOST_LATEST_RELEASES = 'Boost Latest Release',
  IGNORE_HEALTH_CHECKS = 'Ignore Health Checks',
  BOOST_KEY_TRANSACTIONS = 'Boost Key Transactions',
  REBALANCE_TRANSACTIONS = 'Rebalance Transactions', // Boost Low Volume Transactions
  BOOST_REPLAY_ID = 'Boost Replay ID',
  INVESTIGATION_RULE = 'Investigation Rule',
  MINIMUM_SAMPLE_RATE_TARGET = 'Minimum Sample Rate',
}

const getRuleType = ({id}: RuleV2): RuleType | undefined => {
  const RESERVED_IDS = {
    1000: RuleType.BOOST_LOW_VOLUME_PROJECTS,
    1001: RuleType.BOOST_ENVIRONMENTS,
    1002: RuleType.IGNORE_HEALTH_CHECKS,
    1003: RuleType.BOOST_KEY_TRANSACTIONS,
    1004: RuleType.RECALIBRATION_RULE,
    1005: RuleType.BOOST_REPLAY_ID,
    1006: RuleType.MINIMUM_SAMPLE_RATE_TARGET,
  };

  if (id in RESERVED_IDS) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return RESERVED_IDS[id];
  }
  if (id >= 1400 && id < 1500) {
    return RuleType.REBALANCE_TRANSACTIONS;
  }
  if (id >= 1500 && id < 1600) {
    return RuleType.BOOST_LATEST_RELEASES;
  }
  if (id >= 3000 && id < 5000) {
    return RuleType.INVESTIGATION_RULE;
  }

  return undefined;
};

function getStringifiedCondition(condition: Record<string, any>): string {
  const inner = Array.isArray(condition.inner) ? condition.inner : [condition.inner];

  if (isEmpty(inner)) {
    return '<all>';
  }

  const operation = condition.op;

  switch (operation) {
    case 'eq':
      return eq(condition);
    case 'and':
      return and(condition);
    case 'or':
      return or(condition);
    case 'glob':
      return eq(condition);
    case 'not':
      return not(condition);
    case 'gte':
      return gte(condition);
    case 'lte':
      return lte(condition);
    case 'gt':
      return gt(condition);
    case 'lt':
      return lt(condition);
    default:
      return '';
  }
}

function not(data: Record<string, any>): string {
  return `!${getStringifiedCondition(data.inner)}`;
}

function gt(data: Record<string, any>): string {
  return `${data.name}:>${JSON.stringify(data.value)}`;
}

function lt(data: Record<string, any>): string {
  return `${data.name}:<${JSON.stringify(data.value)}`;
}

function gte(data: Record<string, any>): string {
  return `${data.name}:>=${JSON.stringify(data.value)}`;
}

function lte(data: Record<string, any>): string {
  return `${data.name}:<=${JSON.stringify(data.value)}`;
}

function eq(data: Record<string, any>): string {
  return `${data.name}:${JSON.stringify(data.value)}`;
}

function and(data: Record<string, any>): string {
  return data.inner
    .map((cond: Record<string, any>) => getStringifiedCondition(cond))
    .join(' AND ');
}

function or(data: Record<string, any>): string {
  return data.inner
    .map((cond: Record<string, any>) => getStringifiedCondition(cond))
    .join(' OR ');
}

export function DynamicSamplingPanel({projectId, organization}: Props) {
  const api = useApi();
  const regionHost = organization?.links.regionUrl;

  const [projectConfig, setProjectConfig] = useState<ProjectConfig>();
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');

  async function invalidateProjectConfig() {
    try {
      await api.requestPromise(`/internal/project-config/`, {
        host: regionHost,
        method: 'POST',
        data: {projectId},
      });
      addSuccessMessage('Project config successfully invalidated');
    } catch (error) {
      const message = 'Unable to invalidate project config';
      handleXhrErrorResponse(message, error as RequestError);
      addErrorMessage(message);
    }
  }

  useEffect(() => {
    if (!projectId) {
      return;
    }

    async function fetchProjectConfig() {
      try {
        const response: ProjectConfig = await api.requestPromise(
          `/internal/project-config/?projectId=${projectId}`,
          {host: regionHost}
        );

        const defaultConfigId = Object.entries(response.configs).find(
          ([id, dsnConfig]) => {
            if (dsnConfig?.config?.sampling?.rules.length) {
              return id;
            }

            return undefined;
          }
        );

        setProjectConfig(response);
        setSelectedConfigId(defaultConfigId?.[0] ?? '');
      } catch (error) {
        const message = 'Unable to fetch project config';
        handleXhrErrorResponse(message, error as RequestError);
        addErrorMessage(message);
      }
    }

    fetchProjectConfig();
  }, [projectId, api, regionHost]);

  if (!projectConfig) {
    return null;
  }

  const selectedConfig = projectConfig.configs[selectedConfigId]!;

  return (
    <ErrorBoundary>
      <Panel>
        <PanelHeader>
          Dynamic Sampling Rules
          <PanelHeaderRight>
            {selectedConfigId && (
              <CompactSelect
                trigger={triggerProps => (
                  <SelectTrigger.Button {...triggerProps} size="xs" prefix="DSN" />
                )}
                value={selectedConfigId}
                options={Object.keys(projectConfig.configs).map(id => ({
                  value: id,
                  label: id,
                }))}
                onChange={opt => setSelectedConfigId(opt.value)}
              />
            )}
            <ExternalLink
              href={`${regionHost}${api.baseUrl}/internal/project-config/?projectId=${projectId}`}
              data-test-id="raw-project-config"
            >
              <Button icon={<IconOpen />} size="xs">
                Raw Project Config
              </Button>
            </ExternalLink>
            <Button
              size="xs"
              onClick={() => {
                invalidateProjectConfig();
              }}
            >
              Invalidate Project Config
            </Button>
          </PanelHeaderRight>
        </PanelHeader>
        <DynamicSamplingPanelBody config={selectedConfig} />
      </Panel>
    </ErrorBoundary>
  );
}

function DynamicSamplingPanelBody({config: dsnConfig}: {config: DSNConfig | null}) {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const rules = dsnConfig?.config?.sampling?.rules ?? [];

  const baseSampleRate =
    rules.find(rule => getRuleType(rule) === RuleType.BOOST_LOW_VOLUME_PROJECTS)
      ?.samplingValue.value || 0;

  return (
    <PanelBody>
      <SearchBar>
        {baseSampleRate > 0 && (
          <BaseSampleRateWrapper variant="info">
            Base sample rate: {Math.round(baseSampleRate * 100 * 10000) / 10000}%
          </BaseSampleRateWrapper>
        )}
        <SearchInput
          type="text"
          placeholder="Search rules"
          name="query"
          autoComplete="off"
          value={searchQuery}
          onChange={event => setSearchQuery(event.target.value?.toLowerCase())}
        />
      </SearchBar>
      <DynamicSamplingRulesTable
        baseSampleRate={baseSampleRate}
        rules={rules}
        searchQuery={searchQuery}
      />
    </PanelBody>
  );
}

type DynamicSamplingRulesTableProps = {
  baseSampleRate: number;
  searchQuery: string;
  rules?: RuleV2[];
};

function DynamicSamplingRulesTable({
  baseSampleRate,
  searchQuery,
  rules = [],
}: DynamicSamplingRulesTableProps) {
  const round = (value: number) => Math.round(value * 10000) / 10000;

  const formatSamplingRateValue = (samplingValue: any) => {
    if (
      samplingValue.type === 'sampleRate' ||
      samplingValue.type === 'minimumSampleRate'
    ) {
      return `${round(samplingValue.value * 100)}%`;
    }
    if (samplingValue.type === 'reservoir') {
      return `100%`;
    }
    return `* ${round(samplingValue.value)}`;
  };

  const evaluateRuleImpact = (rule: RuleV2) => {
    if (getRuleType(rule) === RuleType.BOOST_LOW_VOLUME_PROJECTS) {
      return 0;
    }
    if (rule.samplingValue.type === 'sampleRate') {
      return round(rule.samplingValue.value - baseSampleRate);
    }
    if (rule.samplingValue.type === 'reservoir') {
      return 1;
    }
    return round(rule.samplingValue.value - 1);
  };

  const dynamicSamplingRules = rules
    .map(rule => {
      return {
        ...rule,
        formattedRateValue: formatSamplingRateValue(rule.samplingValue),
        formattedRateType: startCase(rule.samplingValue.type),
        type: getRuleType(rule),
        target: getStringifiedCondition(rule.condition),
        impact: evaluateRuleImpact(rule),
      };
    })

    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    .filter(row => Object.values(row).join().toLowerCase().includes(searchQuery));

  return (
    <Fragment>
      <DSRulesTable
        headers={['Name', 'Type', 'Value', 'Target']}
        isEmpty={!dynamicSamplingRules.length}
        emptyMessage="No dynamic sampling rules to display"
      >
        {dynamicSamplingRules.map(row => (
          <Fragment key={row.id}>
            <NameColumn>
              {row.type}
              {defined(row.samplingValue.limit) && (
                <NameColumnDetail data-test-id="limit">
                  <strong>Limit:</strong>
                  <span>{row.samplingValue.limit}</span>
                </NameColumnDetail>
              )}
              {defined(row.timeRange) && (
                <div data-test-id="timerange">
                  <NameColumnDetail>
                    <strong>Start:</strong>
                    <span>
                      <DateTime date={row.timeRange.start} />
                    </span>
                  </NameColumnDetail>
                  <NameColumnDetail>
                    <strong>End:</strong>
                    <span>
                      <DateTime date={row.timeRange.end} />
                    </span>
                  </NameColumnDetail>
                </div>
              )}
            </NameColumn>
            <div>{row.formattedRateType}</div>
            <ValueCell>
              <Tooltip isHoverable title={row.samplingValue.value}>
                {row.formattedRateValue}
              </Tooltip>
              <Tooltip
                isHoverable
                title={`This rule ${
                  row.impact > 0 ? 'increases' : 'decreases'
                } sample rate of matching events`}
              >
                <ImpactIndicatorIcon impact={row.impact} size="xs" />
              </Tooltip>
            </ValueCell>
            <div>{row.target}</div>
          </Fragment>
        ))}
      </DSRulesTable>
    </Fragment>
  );
}

const ImpactIndicatorIcon = styled(IconArrow)<{impact: number}>`
  display: ${p => (p.impact === 0 ? 'none' : 'inline-block')};
  color: ${p => (p.impact > 0 ? p.theme.green300 : p.theme.colors.red400)};
  transform: ${p => (p.impact > 0 ? 'rotate(45deg)' : 'rotate(135deg)')};
`;

const SearchBar = styled('div')`
  display: flex;
  align-items: flex-start;
  padding: ${space(1)};
`;

const PanelHeaderRight = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  text-transform: none;
`;

const ValueCell = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: ${space(1)};
  padding-right: ${space(4)};
`;

const BaseSampleRateWrapper = styled(Alert)`
  padding: ${space(1)};
  margin-right: ${space(1)};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  width: max-content;
  flex-basis: 50%;
`;

const DSRulesTable = styled(PanelTable)`
  border: none;
  border-radius: 0 0 4px 4px;
  margin-bottom: 0;
`;

const NameColumn = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const NameColumnDetail = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  > strong {
    margin-right: ${space(0.5)};
  }
`;
