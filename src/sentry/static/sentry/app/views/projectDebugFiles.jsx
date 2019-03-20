import {Box, Flex} from 'grid-emotion';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
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
    default:
      return null;
  }
}

const DebugSymbolDetails = styled.div`
  margin-top: 4px;
`;

class ProjectDebugSymbols extends AsyncComponent {
  getEndpoints() {
    const {orgId, projectId} = this.props.params;

    return [
      [
        'debugFiles',
        `/projects/${orgId}/${projectId}/files/dsyms/`,
        {query: {query: this.props?.location?.query?.query}},
      ],
    ];
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
      const url = `${this.api
        .baseUrl}/projects/${orgId}/${projectId}/files/dsyms/?id=${dsym.id}`;
      const fileType = getFileType(dsym);
      const symbolType = fileType ? `${dsym.symbolType} ${fileType}` : dsym.symbolType;
      const features = dsym.data && dsym.data.features;

      return (
        <PanelItem key={key} align="center" px={2} py={1}>
          <Box w={4.5 / 12}>
            <code className="small">{dsym.debugId || dsym.uuid}</code>
            <Flex mt="4px">
              <Box w={4 / 12} pl="2px">
                <p className="m-b-0 text-light small">
                  <FileSize bytes={dsym.size} />
                </p>
              </Box>
              <Box w={8 / 12} pl={1}>
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
                    <span>
                      <Tag inline>{feature}</Tag>
                    </span>
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
                  onClick={() => (window.location = url)}
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
                      icon="icon-trash"
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
    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Debug Information Files')} />
        <TextBlock>
          {t(`
          Here you can find all your uploaded debug information files (dSYMs, ProGuard, Breakpad ...).
          This is used to convert addresses and minified function names from crash dumps
          into function names and locations.`)}
        </TextBlock>
        <Panel>
          <PanelHeader hasButtons>
            <Box w={4.5 / 12}>{t('Debug ID')}</Box>
            <Box flex="1">{t('Name')}</Box>
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
