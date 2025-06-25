import {Fragment, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {Badge} from 'sentry/components/core/badge';
import {Button} from 'sentry/components/core/button';
import {TabList, TabPanels, Tabs} from 'sentry/components/core/tabs';
import {ModalBody} from 'sentry/components/globalModal/components';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {IconRefresh} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import textStyles from 'sentry/styles/text';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {semverCompare} from 'sentry/utils/versions/semverCompare';
import {OrganizationContext} from 'sentry/views/organizationContext';

type AM2CompatibilityReport = {
  alerts: UnsupportedAlert[];

  ondemand_widgets: Array<{
    dashboard_id: number;
    ondemand_supported: UnsupportedWidget[];
    unsupported: never; // On-demand adds new support for previously unsupported widgets // On-demand adds new support for previously unsupported widgets..
  }>;
  sdks: {
    projects: Array<{
      project: string;
      unsupported: UnsupportedSDK[];
    }>;
    url: string;
  };
  widgets: Array<{
    dashboard_id: number;
    ondemand_supported: never;
    unsupported: UnsupportedWidget[];
  }>;
};

type UnsupportedAlert = {
  aggregate: string;
  id: number;
  query: string;
  url: string;
};

type UnsupportedSDK = {
  sdk_name: string;
  sdk_versions: Array<{
    found: string;
    required: string;
  }>;
};

type UnsupportedWidget = UnsupportedAlert & {
  conditions: string;
  fields: string[];
};

type AM2CompatibilityReportResponse = {
  // 0 = done, 1 = in_progress, 2 = error
  errors: string[];
  results: AM2CompatibilityReport;
  status: 0 | 1 | 2;
};

const FETCH_INTERVAL = 5000;
const FETCH_LIMIT = 15 * 6; // 15 minutes

type Props = {
  organization: Organization;
};

const isInProgress = (status?: 0 | 1 | 2) => status === 1;

const useFetchAM2CompatibilityReport = ({refresh}: any) => {
  const organization = useOrganization();
  const {data, isPending, error} = useApiQuery<AM2CompatibilityReportResponse>(
    [
      `${organization.links.regionUrl}/api/0/internal/check-am2-compatibility/`,
      {query: {orgId: organization.id, refresh}},
    ],
    {
      staleTime: 0,
      // endpoint runs an async and potentially long-running task, so we need to poll
      refetchInterval: query => {
        if (!query.state.data) {
          return false;
        }
        const newData = query.state.data[0];

        if (isInProgress(newData.status) && query.state.dataUpdateCount < FETCH_LIMIT) {
          return FETCH_INTERVAL;
        }

        return false;
      },
    }
  );
  return {data, isPending, error};
};

function AM2CompatibilityCheckModal() {
  const [refresh, setRefresh] = useState(false);
  const {data, isPending, error} = useFetchAM2CompatibilityReport({refresh});

  const isFetched = !isPending && !isInProgress(data?.status);

  useEffect(() => {
    if (refresh && isInProgress(data?.status)) {
      setRefresh(false);
    }
  }, [isFetched, refresh, data?.status]);

  return (
    <Fragment>
      <ModalHeader>
        <span>AM2 Compatibility Check</span>
        <Button
          size="sm"
          disabled={!isFetched}
          aria-label="refresh"
          icon={<IconRefresh />}
          onClick={() => setRefresh(true)}
        />
      </ModalHeader>

      <AM2ReportModalBody>
        {!isFetched && (
          <LoadingIndicator>Hang on, this might take a while!</LoadingIndicator>
        )}
        {error && (
          <Alert.Container>
            <Alert type="error">Something went wrong!</Alert>
          </Alert.Container>
        )}
        {data?.errors && <ErrorBox errors={data.errors} />}
        {data?.results && <AM2Report data={data.results} />}
      </AM2ReportModalBody>
    </Fragment>
  );
}

function ErrorBox({errors}: {errors: string[]}) {
  if (!errors.length) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert
        type="error"
        showIcon
        expand={
          <List>
            {errors.map((error, index) => (
              <ListItem key={index}>{error}</ListItem>
            ))}
          </List>
        }
      >
        {errors.length} problem(s) occurred while processing this request.
      </Alert>
    </Alert.Container>
  );
}

function InfoBox({numOfIssues}: {numOfIssues: number}) {
  const message = numOfIssues
    ? `Found ${numOfIssues} issues. Check the details below for more info.`
    : 'No issues found!';

  return (
    <Alert.Container>
      <Alert showIcon type={numOfIssues ? 'warning' : 'success'}>
        {message}
      </Alert>
    </Alert.Container>
  );
}

function OnDemandBanner({onDemandWidgetCount}: {onDemandWidgetCount: number}) {
  if (!onDemandWidgetCount) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert showIcon type="info">
        On-demand widgets fix support for many of the AM2 incompatible widgets. They are
        listed here so they can be checked for consistency with AM1 data.
      </Alert>
    </Alert.Container>
  );
}
function AM2Report({data}: {data: AM2CompatibilityReport}) {
  const sum = (arr: number[]) => arr.reduce((acc, item) => acc + item, 0);

  const alertCount = data.alerts.length;
  const widgetCount = sum(data.widgets.map(w => w.unsupported.length));
  const onDemandWidgetCount = sum(
    data.ondemand_widgets.map(w => w.ondemand_supported.length)
  );
  const sdkCount = sum(data.sdks.projects.map(p => p.unsupported.length));

  const numOfIssues = alertCount + widgetCount + sdkCount;
  const showTabs = numOfIssues > 0 || onDemandWidgetCount > 0;

  return (
    <Fragment>
      <ModalSectionHeader>Results</ModalSectionHeader>
      <InfoBox numOfIssues={alertCount + widgetCount + sdkCount} />
      {showTabs && (
        <Tabs>
          <TabList>
            <TabList.Item key="alerts">
              Alerts <Badge type="default">{alertCount}</Badge>
            </TabList.Item>
            <TabList.Item key="widgets">
              Widgets <Badge type="default">{widgetCount}</Badge>
            </TabList.Item>
            <TabList.Item key="sdks">
              SDKs <Badge type="default">{sdkCount}</Badge>
            </TabList.Item>
            <TabList.Item key="ondemand_widgets">
              On-demand Widgets <Badge type="new">{onDemandWidgetCount}</Badge>
            </TabList.Item>
          </TabList>
          <TabPanels>
            <TabPanels.Item key="alerts">
              <AlertPanel alerts={data.alerts} />
            </TabPanels.Item>
            <TabPanels.Item key="widgets">
              <WidgetPanel widgets={data.widgets} />
            </TabPanels.Item>
            <TabPanels.Item key="ondemand_widgets">
              <OnDemandBanner onDemandWidgetCount={onDemandWidgetCount} />
              <WidgetPanel widgets={data.ondemand_widgets} onDemand />
            </TabPanels.Item>
            <TabPanels.Item key="sdks">
              <SDKPanel sdks={data.sdks} />
            </TabPanels.Item>
          </TabPanels>
        </Tabs>
      )}
    </Fragment>
  );
}

function AlertPanel({alerts}: {alerts: AM2CompatibilityReport['alerts']}) {
  return (
    <TabPanelTable headers={['query', 'aggregate', 'link']}>
      {alerts.map(alert => (
        <Fragment key={alert.id}>
          <div>{alert.query}</div>
          <div>{alert.aggregate}</div>
          <div>
            <ExternalLink href={alert.url}>Go to alert</ExternalLink>
          </div>
        </Fragment>
      ))}
    </TabPanelTable>
  );
}

function WidgetPanel({
  widgets,
  onDemand,
}: {
  widgets: AM2CompatibilityReport['widgets'] | AM2CompatibilityReport['ondemand_widgets'];
  onDemand?: boolean;
}) {
  return (
    <TabPanelTable headers={['conditions', 'fields', 'link']}>
      {widgets.map(dashboard => (
        <Fragment key={`dashboard-${dashboard.dashboard_id}`}>
          <GroupHeader>Dashboard {dashboard.dashboard_id}</GroupHeader>
          {(dashboard.unsupported || dashboard.ondemand_supported).map((widget, i) => (
            <Fragment key={`widget-${widget.id}-${i}`}>
              <div>{widget.conditions}</div>
              <FieldsCell fields={widget.fields} />
              <div>
                <ExternalLink href={widget.url + (onDemand ? '?forceOnDemand=true' : '')}>
                  Go to widget
                </ExternalLink>
              </div>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </TabPanelTable>
  );
}

function SDKPanel({sdks}: {sdks: AM2CompatibilityReport['sdks']}) {
  return (
    <Fragment>
      <StyledExternalLink href={sdks.url}>View in Discover</StyledExternalLink>
      <TabPanelTable headers={['SDK', 'Version', 'Required version']}>
        {sdks.projects.map(project => (
          <Fragment key={project.project}>
            <GroupHeader>Project {project.project}</GroupHeader>
            {project.unsupported.map(sdk => {
              const foundSdkVersions = sdk.sdk_versions
                .map(sdkVersion => sdkVersion.found)
                .sort(semverCompare)
                .reverse();

              const foundSdkVersionsSuffix =
                foundSdkVersions.length > 1
                  ? `(and ${foundSdkVersions.length - 1} lower)`
                  : '';

              return (
                <Fragment key={sdk.sdk_name}>
                  <div>{sdk.sdk_name}</div>
                  <div>
                    {foundSdkVersions[0]} {foundSdkVersionsSuffix}
                  </div>
                  <div>{sdk.sdk_versions[0]!.required ?? '(not found)'}</div>
                </Fragment>
              );
            })}
          </Fragment>
        ))}
      </TabPanelTable>
    </Fragment>
  );
}

const TabPanelTable = styled(PanelTable)`
  margin-top: ${space(2)};
  margin-bottom: 0;
`;

const ModalHeader = styled('h3')`
  ${textStyles};
  margin-bottom: ${space(2)};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
const ModalSectionHeader = styled('h5')`
  ${textStyles};
  margin-bottom: ${space(2)};
`;

const StyledExternalLink = styled(ExternalLink)`
  display: block;
  margin-top: ${space(2)};
`;

type GroupHeaderProps = {
  children: React.ReactNode;
  cells?: number;
};

function GroupHeader({children, cells = 3}: GroupHeaderProps) {
  return (
    <Fragment>
      <GroupHeaderCell>{children}</GroupHeaderCell>
      {new Array(cells - 1).fill(null).map((_, i) => (
        <GroupHeaderCell key={`gh=${i}`} />
      ))}
    </Fragment>
  );
}

const GroupHeaderCell = styled('div')`
  font-weight: bold;
  padding: ${space(1)} ${space(2)};
  color: ${p => p.theme.subText};
  background: ${p => p.theme.backgroundTertiary};
`;

function FieldsCell({fields}: {fields: string[]}) {
  return (
    <div>
      {fields.map((field, i) => (
        <div key={`field-${i}`}>{field}</div>
      ))}
    </div>
  );
}

const AM2ReportModalBody = styled(ModalBody)`
  max-height: 80vh;
  overflow-y: auto;
`;

const modalCss = css`
  width: 80%;
`;

export const triggerAM2CompatibilityCheck = ({organization}: Props) => {
  return openModal(
    () => (
      <OrganizationContext value={organization}>
        <AM2CompatibilityCheckModal />
      </OrganizationContext>
    ),
    {
      modalCss,
    }
  );
};
