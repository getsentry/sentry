import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Button} from 'sentry/components/button';
import DataExport, {ExportQueryType} from 'sentry/components/dataExport';
import {Hovercard} from 'sentry/components/hovercard';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconDownload, IconQuestion, IconStack, IconTag} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OrganizationSummary} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {
  ApiQueryKey,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

import {downloadAsCsv} from '../utils';

// Number of samples under which we can trigger an investigation rule
const INVESTIGATION_MAX_SAMPLES_TRIGGER = 5;

type Props = {
  error: string | null;
  eventView: EventView;
  isLoading: boolean;
  location: Location;
  onChangeShowTags: () => void;
  onEdit: () => void;
  organization: OrganizationSummary;
  showTags: boolean;
  tableData: TableData | null | undefined;
  title: string;
};

function handleDownloadAsCsv(title: string, {organization, eventView, tableData}: Props) {
  trackAnalytics('discover_v2.results.download_csv', {
    organization: organization.id, // org summary
  });
  downloadAsCsv(tableData, eventView.getColumns(), title);
}

function renderDownloadButton(canEdit: boolean, props: Props) {
  const {tableData} = props;
  return (
    <Feature
      features={['organizations:discover-query']}
      renderDisabled={() => renderBrowserExportButton(canEdit, props)}
    >
      {tableData?.data && tableData.data.length < 50
        ? renderBrowserExportButton(canEdit, props)
        : renderAsyncExportButton(canEdit, props)}
    </Feature>
  );
}

function renderBrowserExportButton(canEdit: boolean, props: Props) {
  const {isLoading, error} = props;
  const disabled = isLoading || error !== null || canEdit === false;
  const onClick = disabled ? undefined : () => handleDownloadAsCsv(props.title, props);

  return (
    <Button
      size="sm"
      disabled={disabled}
      onClick={onClick}
      data-test-id="grid-download-csv"
      icon={<IconDownload size="xs" />}
      title={t(
        "There aren't that many results, start your export and it'll download immediately."
      )}
    >
      {t('Export All')}
    </Button>
  );
}

function renderAsyncExportButton(canEdit: boolean, props: Props) {
  const {isLoading, error, location, eventView} = props;
  const disabled = isLoading || error !== null || canEdit === false;
  return (
    <DataExport
      payload={{
        queryType: ExportQueryType.DISCOVER,
        queryInfo: eventView.getEventsAPIPayload(location),
      }}
      disabled={disabled}
      icon={<IconDownload size="xs" />}
    >
      {t('Export All')}
    </DataExport>
  );
}

// Placate eslint proptype checking

function renderEditButton(canEdit: boolean, props: Props) {
  const onClick = canEdit ? props.onEdit : undefined;
  return (
    <GuideAnchor target="columns_header_button">
      <Button
        size="sm"
        disabled={!canEdit}
        onClick={onClick}
        data-test-id="grid-edit-enable"
        icon={<IconStack size="xs" />}
      >
        {t('Columns')}
      </Button>
    </GuideAnchor>
  );
}

// Placate eslint proptype checking

function renderSummaryButton({onChangeShowTags, showTags}: Props) {
  return (
    <Button size="sm" onClick={onChangeShowTags} icon={<IconTag size="xs" />}>
      {showTags ? t('Hide Tags') : t('Show Tags')}
    </Button>
  );
}

type FeatureWrapperProps = Props & {
  children: (hasFeature: boolean, props: Props) => React.ReactNode;
};

function FeatureWrapper(props: FeatureWrapperProps) {
  const noEditMessage = t('Requires discover query feature.');
  const editFeatures = ['organizations:discover-query'];

  const renderDisabled = p => (
    <Hovercard
      body={
        <FeatureDisabled
          features={p.features}
          hideHelpToggle
          message={noEditMessage}
          featureName={noEditMessage}
        />
      }
    >
      {p.children(p)}
    </Hovercard>
  );
  return (
    <Feature
      hookName="feature-disabled:grid-editable-actions"
      renderDisabled={renderDisabled}
      features={editFeatures}
    >
      {({hasFeature}) => props.children(hasFeature, props)}
    </Feature>
  );
}

function TableActions(props: Props) {
  return (
    <div className="table-actions">
      <Fragment>
        <InvestigationRuleCreation {...props} key="investigationRuleCreation" />
        <FeatureWrapper {...props} key="edit">
          {renderEditButton}
        </FeatureWrapper>
        <FeatureWrapper {...props} key="download">
          {renderDownloadButton}
        </FeatureWrapper>
        {renderSummaryButton(props)}
      </Fragment>
    </div>
  );
}

type CustomRule = {
  condition: Record<string, any>;
  dateAdded: string;
  endDate: string;
  numSamples: number;
  orgId: string;
  projects: number[];
  ruleId: number;
  sampleRate: number;
  startDate: string;
};

type CreateCustomRuleVariables = {
  organization: OrganizationSummary;
  period: string | null;
  projects: number[];
  query: string;
};

function makeRuleExistsQueryKey(
  query: string,
  projects: number[],
  organization: OrganizationSummary
): ApiQueryKey {
  return [
    `/api/0/organizations/${organization.slug}/dynamic-sampling/custom-rules/`,
    {
      query: {
        project: projects,
        query,
      },
    },
  ];
}

function useGetExistingRule(
  query: string,
  projects: number[],
  organization: OrganizationSummary,
  tableData: TableData | null | undefined
) {
  const enabled =
    tableData?.data && tableData.data.length < INVESTIGATION_MAX_SAMPLES_TRIGGER;

  const result = useApiQuery<CustomRule | '' | null>(
    makeRuleExistsQueryKey(query, projects, organization),
    {
      staleTime: 0,
      enabled,
    }
  );

  if (result.data === '') {
    // cleanup, the endpoint returns a 204 (with no body), change it to null
    result.data = null;
  }

  return result;
}

function useCreateInvestigationRuleMutation(vars: CreateCustomRuleVariables) {
  const api = useApi();
  const queryClient = useQueryClient();
  const {mutate} = useMutation<CustomRule, Error, CreateCustomRuleVariables>({
    mutationFn: (variables: CreateCustomRuleVariables) => {
      const {organization} = variables;
      const endpoint = `/api/0/organizations/${organization.slug}/dynamic-sampling/custom-rules/`;
      return api.requestPromise(endpoint, {
        method: 'POST',
        data: variables,
      });
    },
    onSuccess: (_data: CustomRule) => {
      addSuccessMessage(t('Successfully created investigation rule'));
      // invalidate the rule-exists query
      queryClient.invalidateQueries(
        makeRuleExistsQueryKey(vars.query, vars.projects, vars.organization)
      );
    },
    onError: (_error: Error) => {
      addErrorMessage(t('Unable to create investigation rule'));
    },
  });
  return mutate;
}

const InvestigationInProgressNotification = styled('span')`
  margin: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: ${space(0.5)};
`;

function InvestigationRuleCreation(props: Props) {
  const projects = [...props.eventView.project];
  const organization = props.organization;
  const period = props.eventView.statsPeriod || null;
  const query = props.eventView.getQuery();
  const createInvestigationRule = useCreateInvestigationRuleMutation({
    query,
    projects,
    organization,
    period,
  });
  const request = useGetExistingRule(query, projects, organization, props.tableData);

  if (
    !props.tableData?.data ||
    props.tableData.data.length > INVESTIGATION_MAX_SAMPLES_TRIGGER
  ) {
    // no results yet (we can't take a decision) or enough results,
    // we don't need investigation rule UI
    return null;
  }
  if (request.isLoading) {
    return null;
  }

  if (request.error !== null) {
    const errorResponse = t('Unable to fetch custom performance metrics');
    addErrorMessage(errorResponse);
    return null;
  }

  const rule = request.data;
  const haveInvestigationRuleInProgress = rule !== null;

  if (haveInvestigationRuleInProgress) {
    // investigation rule in progress just show a message
    const ruleStartDate = new Date(rule.startDate);
    const now = new Date();
    const interval = moment.duration(now.getTime() - ruleStartDate.getTime()).humanize();

    return (
      <InvestigationInProgressNotification>
        {tct('Collecting samples since [interval]  ago.', {interval})}

        <Tooltip
          isHoverable
          title={tct(
            'A user has temporarily adjusted retention priorities, increasing the odds of getting events matching your search query. [link:Learn more.]',
            // TODO find out where this link is pointing to
            {
              link: <ExternalLink href="https://docs.sentry.io" />,
            }
          )}
        >
          <IconQuestion size="xs" color="subText" />
        </Tooltip>
      </InvestigationInProgressNotification>
    );
  }

  // no investigation rule in progress show a button to create one
  return (
    <Tooltip
      isHoverable
      title={tct(
        'We can find more events that match your search query by adjusting your retention priorities for an hour, increasing the odds of getting matching events. [link:Learn more.]',
        // TODO find out where this link is pointing to
        {
          link: <ExternalLink href="https://docs.sentry.io" />,
        }
      )}
    >
      <Button
        size="sm"
        onClick={() => createInvestigationRule({organization, period, projects, query})}
        icon={<IconTag size="xs" />}
      >
        {t('Get samples')}
      </Button>
    </Tooltip>
  );
}

export default TableActions;
