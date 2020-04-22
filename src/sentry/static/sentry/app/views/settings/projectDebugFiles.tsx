import {Box, Flex} from 'reflexbox';
import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {fields} from 'app/data/forms/projectDebugFiles';
import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {IconDelete} from 'app/icons/iconDelete';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import FileSize from 'app/components/fileSize';
import Pagination from 'app/components/pagination';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Tag from 'app/views/settings/components/tag';
import TextBlock from 'app/views/settings/components/text/textBlock';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';

function getFileType(dsym: DebugFile) {
  switch (dsym.data?.type) {
    case DebugFileType.EXE:
      return t('executable');
    case DebugFileType.DBG:
      return t('debug companion');
    case DebugFileType.LIB:
      return t('dynamic library');
    default:
      return null;
  }
}

function getFeatureTooltip(feature: DebugFileFeature) {
  switch (feature) {
    case DebugFileFeature.SYMTAB:
      return t(
        'Symbol tables are used as a fallback when full debug information is not available'
      );
    case DebugFileFeature.DEBUG:
      return t(
        'Debug information provides function names and resolves inlined frames during symbolication'
      );
    case DebugFileFeature.UNWIND:
      return t(
        'Stack unwinding information improves the quality of stack traces extracted from minidumps'
      );
    case DebugFileFeature.SOURCES:
      return t(
        'Source code information allows Sentry to display source code context for stack frames'
      );
    default:
      return null;
  }
}

type BuiltinSymbolSource = {
  hidden: boolean;
  id: string;
  name: string;
  sentry_key: string;
};

enum DebugFileType {
  EXE = 'exe',
  DBG = 'dbg',
  LIB = 'lib',
}

enum DebugFileFeature {
  SYMTAB = 'symtab',
  DEBUG = 'debug',
  UNWIND = 'unwind',
  SOURCES = 'sources',
}

type DebugFile = {
  codeId: string;
  cpuName: string;
  dateCreated: string;
  debugId: string;
  headers: Record<string, string>;
  id: string;
  objectName: string;
  sha1: string;
  size: number;
  symbolType: string;
  uuid: string;
  data?: {type: DebugFileType; features: DebugFileFeature[]};
};

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  debugFiles: DebugFile[];
  builtinSymbolSources?: BuiltinSymbolSource[];
};

class ProjectDebugSymbols extends AsyncView<Props, State> {
  getTitle() {
    const {projectId} = this.props.params;

    return routeTitleGen(t('Debug Files'), projectId, false);
  }

  getEndpoints() {
    const {organization, params, location} = this.props;
    const {orgId, projectId} = params;

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      [
        'debugFiles',
        `/projects/${orgId}/${projectId}/files/dsyms/`,
        {query: {query: location.query.query}},
      ],
    ];

    if (organization.features.includes('symbol-sources')) {
      endpoints.push(['builtinSymbolSources', '/builtin-symbol-sources/']);
    }

    return endpoints;
  }

  onDelete(id: string) {
    const {orgId, projectId} = this.props.params;

    this.setState({
      loading: true,
    });

    this.api.request(`/projects/${orgId}/${projectId}/files/dsyms/?id=${id}`, {
      method: 'DELETE',
      complete: () => this.fetchData(),
    });
  }

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t('There are no debug symbols for this project.')}</p>
      </EmptyStateWarning>
    );
  }

  renderDsyms() {
    const {debugFiles} = this.state;
    const {orgId, projectId} = this.props.params;

    return debugFiles.map((dsym, key) => {
      const url = `${this.api.baseUrl}/projects/${orgId}/${projectId}/files/dsyms/?id=${dsym.id}`;
      const fileType = getFileType(dsym);
      const symbolType = fileType ? `${dsym.symbolType} ${fileType}` : dsym.symbolType;
      const {features} = dsym.data || {};

      return (
        <PanelItem key={key} alignItems="center" px={2} py={1}>
          <Box width={4.5 / 12}>
            <code className="small">{dsym.debugId || dsym.uuid}</code>
            <Flex mt="4px">
              <Box width={4 / 12} pl="2px">
                <p className="m-b-0 text-light small">
                  <FileSize bytes={dsym.size} />
                </p>
              </Box>
              <Box width={8 / 12} pl={1}>
                <p className="m-b-0 text-light small">
                  <span className="icon icon-clock" />{' '}
                  <TimeSince date={dsym.dateCreated} />
                </p>
              </Box>
            </Flex>
          </Box>
          <Box flex="1">
            {dsym.symbolType === 'proguard' && dsym.objectName === 'proguard-mapping'
              ? '-'
              : dsym.objectName}
            <DebugSymbolDetails className="text-light small">
              {dsym.symbolType === 'proguard' && dsym.cpuName === 'any'
                ? 'proguard mapping'
                : `${dsym.cpuName} (${symbolType})`}

              {features &&
                features.map(feature => (
                  <Tooltip key={feature} title={getFeatureTooltip(feature)}>
                    <Tag inline>{feature}</Tag>
                  </Tooltip>
                ))}
            </DebugSymbolDetails>
          </Box>
          <Box>
            <Access access={['project:releases']}>
              {({hasAccess}) => (
                <Button
                  size="xsmall"
                  icon="icon-download"
                  href={url}
                  disabled={!hasAccess}
                  css={{
                    marginRight: space(0.5),
                  }}
                >
                  {t('Download')}
                </Button>
              )}
            </Access>
            <Access access={['project:write']}>
              {({hasAccess}) => (
                <Tooltip
                  disabled={hasAccess}
                  title={t('You do not have permission to delete debug files.')}
                >
                  <Confirm
                    confirmText={t('Delete')}
                    message={t('Are you sure you wish to delete this file?')}
                    onConfirm={() => this.onDelete(dsym.id)}
                    disabled={!hasAccess}
                  >
                    <Button
                      priority="danger"
                      icon={<IconDelete size="xs" />}
                      size="xsmall"
                      disabled={!hasAccess}
                    />
                  </Confirm>
                </Tooltip>
              )}
            </Access>
          </Box>
        </PanelItem>
      );
    });
  }

  renderBody() {
    const {organization, project, params} = this.props;
    const {builtinSymbolSources, debugFiles, debugFilesPageLinks} = this.state;
    const {orgId, projectId} = params;
    const {features, access} = organization;

    const fieldProps = {
      organization,
      builtinSymbolSources,
    };

    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Debug Information Files')} />

        <TextBlock>
          {t(`
            Debug information files are used to convert addresses and minified
            function names from native crash reports into function names and
            locations.
          `)}
        </TextBlock>

        {features.includes('symbol-sources') && (
          <React.Fragment>
            <PermissionAlert />

            <Form
              saveOnBlur
              allowUndo
              initialData={project}
              apiMethod="PUT"
              apiEndpoint={`/projects/${orgId}/${projectId}/`}
            >
              <JsonForm
                features={new Set(features)}
                title={t('External Sources')}
                disabled={!access.includes('project:write')}
                fields={[fields.symbolSources, fields.builtinSymbolSources]}
                additionalFieldProps={fieldProps}
              />
            </Form>
          </React.Fragment>
        )}

        <TextBlock>
          {t('This list contains all uploaded debug information files:')}
        </TextBlock>

        <Panel>
          <PanelHeader hasButtons>
            <Box width={4.5 / 12}>{t('Debug ID')}</Box>
            <Box minWidth="auto" flex="1">
              {t('Name')}
            </Box>
            <Box>
              {this.renderSearchInput({
                updateRoute: true,
                placeholder: t('Search DIFs'),
                className: 'search',
              })}
            </Box>
          </PanelHeader>
          <PanelBody>
            {debugFiles.length > 0 ? this.renderDsyms() : this.renderEmpty()}
          </PanelBody>
        </Panel>
        <Pagination pageLinks={debugFilesPageLinks} />
      </React.Fragment>
    );
  }
}

const DebugSymbolDetails = styled('div')`
  margin-top: ${space(0.5)};
`;

export default ProjectDebugSymbols;
