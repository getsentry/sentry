import {Box, Flex} from 'reflexbox';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {fields} from 'app/data/forms/projectDebugFiles';
import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import AsyncComponent from 'app/components/asyncComponent';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
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

function getFileType(dsym) {
  switch (dsym.data && dsym.data.type) {
    case 'exe':
      return t('executable');
    case 'dbg':
      return t('debug companion');
    case 'lib':
      return t('dynamic library');
    default:
      return null;
  }
}

function getFeatureTooltip(feature) {
  switch (feature) {
    case 'symtab':
      return t(
        'Symbol tables are used as a fallback when full debug information is not available'
      );
    case 'debug':
      return t(
        'Debug information provides function names and resolves inlined frames during symbolication'
      );
    case 'unwind':
      return t(
        'Stack unwinding information improves the quality of stack traces extracted from minidumps'
      );
    case 'sources':
      return t(
        'Source code information allows Sentry to display source code context for stack frames'
      );
    default:
      return null;
  }
}

const DebugSymbolDetails = styled('div')`
  margin-top: 4px;
`;

class ProjectDebugSymbols extends AsyncComponent {
  static contextTypes = {
    organization: PropTypes.object.isRequired,
  };

  getEndpoints() {
    const {orgId, projectId} = this.props.params;
    const {organization} = this.context;
    const features = new Set(organization.features);

    const endpoints = [
      ['project', `/projects/${orgId}/${projectId}/`],
      [
        'debugFiles',
        `/projects/${orgId}/${projectId}/files/dsyms/`,
        {query: {query: this.props.location.query.query}},
      ],
    ];

    if (features.has('symbol-sources')) {
      endpoints.push(['builtinSymbolSources', '/builtin-symbol-sources/']);
    }

    return endpoints;
  }

  onDelete(id) {
    const {orgId, projectId} = this.props.params;
    this.setState({
      loading: true,
    });
    this.api.request(`/projects/${orgId}/${projectId}/files/dsyms/?id=${id}`, {
      method: 'DELETE',
      complete: () => this.fetchData(),
    });
  }

  renderNoQueryResults() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no releases match your filters.')}</p>
      </EmptyStateWarning>
    );
  }

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t('There are no debug symbols for this project.')}</p>
      </EmptyStateWarning>
    );
  }

  renderDsyms() {
    const {orgId, projectId} = this.props.params;

    const rows = this.state.debugFiles.map((dsym, key) => {
      const url = `${this.api.baseUrl}/projects/${orgId}/${projectId}/files/dsyms/?id=${dsym.id}`;
      const fileType = getFileType(dsym);
      const symbolType = fileType ? `${dsym.symbolType} ${fileType}` : dsym.symbolType;
      const features = dsym.data && dsym.data.features;

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
                    title={t('Delete')}
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

    return rows;
  }

  renderDebugSymbols() {
    return this.state.debugFiles.length > 0 ? this.renderDsyms() : this.renderEmpty();
  }

  renderBody() {
    const {orgId, projectId} = this.props.params;
    const {organization} = this.context;
    const {project} = this.state;
    const features = new Set(organization.features);
    const access = new Set(organization.access);

    const fieldProps = {
      organization,
      builtinSymbolSources: this.state.builtinSymbolSources,
    };

    return (
      <React.Fragment>
        <SentryDocumentTitle objSlug={projectId} title={t('Debug Files')} />

        <SettingsPageHeader title={t('Debug Information Files')} />

        <TextBlock>
          {t(`
            Debug information files are used to convert addresses and minified
            function names from native crash reports into function names and
            locations.
          `)}
        </TextBlock>

        {features.has('symbol-sources') && (
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
                access={access}
                features={features}
                title={t('External Sources')}
                disabled={!access.has('project:write')}
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
          <PanelBody>{this.renderDebugSymbols()}</PanelBody>
        </Panel>
        <Pagination pageLinks={this.state.debugFilesPageLinks} />
      </React.Fragment>
    );
  }
}

export default ProjectDebugSymbols;
