import {Flex} from 'grid-emotion';
import Modal from 'react-bootstrap/lib/Modal';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {t} from '../locale';
import ApiMixin from '../mixins/apiMixin';
import DateTime from '../components/dateTime';
import FileSize from '../components/fileSize';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import OrganizationState from '../mixins/organizationState';
import {Panel, PanelBody, PanelHeader, PanelItem} from '../components/panels';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import TextBlock from './settings/components/text/textBlock';
import TimeSince from '../components/timeSince';
import EmptyStateWarning from '../components/emptyStateWarning';

const marginBottomStyle = {marginBottom: 40};

const LastSeen = styled(Flex)`
  font-size: 12px;
  color: ${p => p.theme.purple2};
`;

const TimeIcon = styled.span`
  margin-right: 4px;
`;

const HoverablePanelItem = styled(PanelItem)`
  cursor: pointer;
  transition: all 0s ease-in-out;
  &:hover {
    background-color: ${p => p.theme.whiteDark};
  }
`;

const ProjectDebugSymbols = createReactClass({
  displayName: 'ProjectDebugSymbols',
  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      showModal: false,
      debugSymbols: [],
      unreferencedDebugSymbols: [],
      apps: [],
      activeAppID: null,
      activeVersion: null,
      activeBuilds: null,
      activeBuild: null,
      activeDsyms: null,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/files/dsyms/`, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          debugSymbols: data.debugSymbols,
          unreferencedDebugSymbols: data.unreferencedDebugSymbols,
          apps: data.apps,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  setActive(appID, version, builds) {
    this.setState({
      activeAppID: appID,
      activeVersion: version,
      activeBuilds: builds,
    });
  },

  openModal(build, dsyms) {
    this.setState({
      showModal: true,
      activeBuild: build,
      activeDsyms: dsyms,
    });
  },

  closeModal() {
    this.setState({
      showModal: false,
    });
  },

  renderDebugTable() {
    let body;

    if (this.state.loading) {
      body = this.renderLoading();
    } else if (this.state.error) {
      body = <LoadingError onRetry={this.fetchData} />;
    } else if (this.state.debugSymbols.length > 0) {
      body = this.renderResults();
    } else {
      body = this.renderEmpty();
    }

    return body;
  },

  renderLoading() {
    return (
      <Panel>
        <LoadingIndicator />
      </Panel>
    );
  },

  renderEmpty() {
    return (
      <Panel>
        <EmptyStateWarning>
          <p>{t('There are no debug symbols for this project.')}</p>
        </EmptyStateWarning>
      </Panel>
    );
  },

  mapObject(object, callback) {
    if (object === undefined) {
      return [];
    }
    return Object.keys(object).map(function(key) {
      return callback(object[key], key);
    });
  },

  renderResults() {
    let groupedDsyms = [];
    this.state.debugSymbols.map((dsym, idx) => {
      if (groupedDsyms[dsym.dsymAppId] === undefined) {
        groupedDsyms[dsym.dsymAppId] = [];
      }
      if (groupedDsyms[dsym.dsymAppId][dsym.version] === undefined) {
        groupedDsyms[dsym.dsymAppId][dsym.version] = [];
      }
      if (groupedDsyms[dsym.dsymAppId][dsym.version][dsym.build] === undefined) {
        groupedDsyms[dsym.dsymAppId][dsym.version][dsym.build] = [];
      }
      groupedDsyms[dsym.dsymAppId][dsym.version][dsym.build].push(dsym);
    });

    let indexedApps = [];
    if (this.state.apps) {
      this.state.apps.map((app, idx) => {
        indexedApps[app.id] = app;
      });
    }

    return indexedApps.map(app => {
      return (
        <Panel style={marginBottomStyle} key={app.id}>
          <PanelHeader>
            <div
              className="app-icon"
              style={app.iconUrl && {backgroundImage: `url(${app.iconUrl})`}}
            />
            {app.name} <small>({app.appId})</small>
          </PanelHeader>

          <PanelBody>
            {this.mapObject(groupedDsyms[app.id], (builds, version) => {
              let symbolsInVersion = 0;
              let lastSeen = null;
              this.mapObject(groupedDsyms[app.id][version], (dsyms, build) => {
                symbolsInVersion += Object.keys(dsyms).length;
                if (
                  lastSeen === null ||
                  (lastSeen &&
                    new Date(dsyms[0].dateAdded).getTime() > new Date(lastSeen).getTime())
                ) {
                  lastSeen = dsyms[0].dateAdded;
                }
              });
              let row = (
                <HoverablePanelItem
                  className="hoverable"
                  onClick={() => this.setActive(app.id, version, builds)}
                >
                  <Flex p={2} flex="1" direction="column">
                    <h3 className="truncate">{version}</h3>
                    <div className="event-message">
                      {t('Builds')}: {Object.keys(builds).length}
                    </div>
                    <LastSeen align="center">
                      <TimeIcon className="icon icon-clock" />
                      <TimeSince date={lastSeen} />
                    </LastSeen>
                  </Flex>
                  <Flex p={2}>
                    {t('Debug Information Files')}: {symbolsInVersion}
                  </Flex>
                </HoverablePanelItem>
              );

              let buildPanelItems = '';
              if (
                this.state.activeVersion &&
                this.state.activeBuilds &&
                this.state.activeVersion == version &&
                this.state.activeAppID == app.id
              ) {
                buildPanelItems = this.renderBuilds(version, this.state.activeBuilds);
              }
              return (
                <PanelItem direction="column" key={version}>
                  {row}
                  {buildPanelItems}
                </PanelItem>
              );
            })}
          </PanelBody>
        </Panel>
      );
    });
  },

  renderBuilds(version, builds) {
    let buildPanelItems = [];
    let dateAdded = null;
    this.mapObject(builds, (dsyms, build) => {
      if (
        dateAdded === null ||
        (dateAdded &&
          new Date(dsyms[0].dateAdded).getTime() > new Date(dateAdded).getTime())
      ) {
        dateAdded = dsyms[0].dateAdded;
      }
    });
    this.mapObject(builds, (dsyms, build) => {
      buildPanelItems.push(
        <HoverablePanelItem key={build} onClick={() => this.openModal(build, dsyms)}>
          <Flex p={2} flex="1" direction="column">
            <div>{build}</div>
            <LastSeen align="center">
              <TimeIcon className="icon icon-clock" />
              <TimeSince date={dateAdded} />
            </LastSeen>
          </Flex>
          <Flex p={2}>
            {t('Debug Information Files')}: {dsyms.length}
          </Flex>
        </HoverablePanelItem>
      );
    });
    return buildPanelItems;
  },

  renderDsyms(dsyms, raw) {
    if (dsyms === null) {
      return null;
    }

    let moreSymbolsHidden = null;
    if (raw && dsyms.length >= 100) {
      moreSymbolsHidden = (
        <tr className="text-center" key="empty-row">
          <td colSpan="6">{t('There are more symbols than are shown here.')}</td>
        </tr>
      );
    }

    let {orgId, projectId} = this.props.params;
    let access = this.getAccess();

    const rows = dsyms.map((dsymFile, key) => {
      let dsym = raw ? dsymFile : dsymFile.dsym;
      if (dsym === undefined || dsym === null) {
        return null;
      }
      const url = `${this.api
        .baseUrl}/projects/${orgId}/${projectId}/files/dsyms/?download_id=${dsym.id}`;
      return (
        <tr key={key}>
          <td>
            <code className="small">{dsym.debugId || dsym.uuid}</code>
          </td>
          <td>
            {dsym.symbolType === 'proguard' && dsym.objectName === 'proguard-mapping'
              ? '-'
              : dsym.objectName}
          </td>
          <td>
            {dsym.symbolType === 'proguard' && dsym.cpuName === 'any'
              ? 'proguard'
              : `${dsym.cpuName} (${dsym.symbolType})`}
          </td>
          <td>
            <DateTime date={dsym.dateCreated} />
          </td>
          <td>
            <FileSize bytes={dsym.size} />
          </td>
          <td>
            {access.has('project:write') ? (
              <a href={url} className="btn btn-sm btn-default">
                <span className="icon icon-open" />
              </a>
            ) : null}
          </td>
        </tr>
      );
    });

    rows.push(moreSymbolsHidden);
    return rows;
  },

  renderUnreferencedDebugSymbols() {
    if (this.state.loading) {
      return null;
    }
    return (
      <div>
        <SettingsPageHeader title={t('Unreferenced Debug Information Files')} />
        <TextBlock>
          {t(
            `
          This list represents all Debug Information Files which are not assigned to an
          app version. We will still find these debug symbols for symbolication
          but we can't tell you which versions they belong to.  This happens
          if you upload them with an old verison of sentry-cli or if sentry-cli
          can't locate the Info.plist file at the time of upload.
        `
          )}
        </TextBlock>
        <table className="table">
          <thead>
            <tr>
              <th>{t('Debug ID')}</th>
              <th>{t('Object')}</th>
              <th>{t('Type')}</th>
              <th>{t('Uploaded')}</th>
              <th>{t('Size')}</th>
              <th />
            </tr>
          </thead>
          <tbody>{this.renderDsyms(this.state.unreferencedDebugSymbols, true)}</tbody>
        </table>
      </div>
    );
  },

  render() {
    return (
      <div>
        <SettingsPageHeader title={t('Debug Information Files')} />
        <TextBlock>
          {t(
            `
          Here you can find uploaded debug information (for instance debug
          symbol files or proguard mappings).  This is used to convert
          addresses and minified function names from crash dumps
          into function names and locations.  For JavaScript debug support
          look at releases instead.
        `
          )}
        </TextBlock>

        {this.renderDebugTable()}

        {this.renderUnreferencedDebugSymbols()}

        <Modal
          show={this.state.showModal}
          onHide={this.closeModal}
          animation={false}
          backdrop="static"
          enforceFocus={false}
          bsSize="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              {this.state.activeVersion} ({this.state.activeBuild})
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Debug ID')}</th>
                  <th>{t('Object')}</th>
                  <th>{t('Type')}</th>
                  <th>{t('Uploaded')}</th>
                  <th>{t('Size')}</th>
                </tr>
              </thead>
              <tbody>{this.renderDsyms(this.state.activeDsyms)}</tbody>
            </table>
          </Modal.Body>
        </Modal>
      </div>
    );
  },
});

export default ProjectDebugSymbols;
