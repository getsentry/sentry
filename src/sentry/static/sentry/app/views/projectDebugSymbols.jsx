import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import DateTime from '../components/dateTime';
import FileSize from '../components/fileSize';
import TimeSince from '../components/timeSince';
import Modal from 'react-bootstrap/lib/Modal';
import {t} from '../locale';

const ProjectDebugSymbols = React.createClass({
  mixins: [ApiMixin],

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
      activeDsyms: null
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
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  setActive(appID, version, builds) {
    this.setState({
      activeAppID: appID,
      activeVersion: version,
      activeBuilds: builds
    });
  },

  openModal(build, dsyms) {
    this.setState({
      showModal: true,
      activeBuild: build,
      activeDsyms: dsyms
    });
  },

  closeModal() {
    this.setState({
      showModal: false
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
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('There are no debug symbols for this project.')}</p>
      </div>
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
        <div className="box dashboard-widget" key={app.id}>
          <div className="box-content">
            <div className="tab-pane active">
              <div>
                <div className="box-header clearfix">
                  <div className="row">
                    <h3 className="debug-symbols">
                      <div
                        className="app-icon"
                        style={app.iconUrl && {backgroundImage: `url(${app.iconUrl})`}}
                      />
                      {app.name} <small>({app.appId})</small>
                    </h3>
                  </div>
                </div>
                {this.mapObject(groupedDsyms[app.id], (builds, version) => {
                  let symbolsInVersion = 0;
                  let lastSeen = null;
                  this.mapObject(groupedDsyms[app.id][version], (dsyms, build) => {
                    symbolsInVersion += Object.keys(dsyms).length;
                    if (
                      lastSeen === null ||
                      (lastSeen &&
                        new Date(dsyms[0].dateAdded).getTime() >
                          new Date(lastSeen).getTime())
                    ) {
                      lastSeen = dsyms[0].dateAdded;
                    }
                  });
                  let row = (
                    <li
                      className="group hoverable"
                      onClick={() => this.setActive(app.id, version, builds)}>
                      <div className="row">
                        <div className="col-xs-8 event-details">
                          <h3 className="truncate">{version}</h3>
                          <div className="event-message">
                            {t('Builds')}: {Object.keys(builds).length}
                          </div>
                          <div className="event-extra">
                            <ul>
                              <li>
                                <span className="icon icon-clock" />
                                <TimeSince date={lastSeen} />
                              </li>
                            </ul>
                          </div>
                        </div>
                        <div className="col-xs-4 event-count align-right">
                          {t('Debug Information Files')}: {symbolsInVersion}
                        </div>
                      </div>
                    </li>
                  );

                  let buildRows = '';
                  if (
                    this.state.activeVersion &&
                    this.state.activeBuilds &&
                    this.state.activeVersion == version &&
                    this.state.activeAppID == app.id
                  ) {
                    buildRows = this.renderBuilds(version, this.state.activeBuilds);
                  }
                  return (
                    <div className="box-content" key={version}>
                      <div className="tab-pane active">
                        <ul className="group-list group-list-small">
                          {row}
                          {buildRows}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    });
  },

  renderBuilds(version, builds) {
    let buildRows = [];
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
      buildRows.push(
        <li
          className="group hoverable"
          key={build}
          onClick={() => this.openModal(build, dsyms)}>
          <div className="row">
            <div className="col-xs-8 event-details">
              <div className="event-message">
                {build}
              </div>
              <div className="event-extra">
                <ul>
                  <li>
                    <span className="icon icon-clock" />
                    <TimeSince date={dateAdded} />
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-xs-4 event-details">
              <div className="event-message">
                <span className="align-right pull-right" style={{paddingRight: 16}}>
                  {t('Debug Information Files')}: {dsyms.length}
                </span>
              </div>
            </div>
          </div>
        </li>
      );
    });
    return buildRows;
  },

  renderDsyms(dsyms, raw) {
    if (dsyms === null) {
      return null;
    }

    let moreSymbolsHidden = null;
    if (raw && dsyms.length >= 100) {
      moreSymbolsHidden = (
        <tr className="text-center" key="empty-row">
          <td colSpan="5">{t('There are more symbols than are shown here.')}</td>
        </tr>
      );
    }

    const rows = dsyms.map((dsymFile, key) => {
      let dsym = raw ? dsymFile : dsymFile.dsym;
      if (dsym === undefined || dsym === null) {
        return null;
      }
      return (
        <tr key={key}>
          <td><code className="small">{dsym.uuid}</code></td>
          <td>{
            dsym.symbolType === 'proguard' && dsym.objectName === 'proguard-mapping'
            ? '-' : dsym.objectName}</td>
          <td>{dsym.symbolType === 'proguard' && dsym.cpuName === 'any'
            ? 'proguard' : `${dsym.cpuName} (${dsym.symbolType})`}</td>
          <td><DateTime date={dsym.dateCreated} /></td>
          <td><FileSize bytes={dsym.size} /></td>
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
        <h3>{t('Unreferenced Debug Information Files')}</h3>
        <p>
          {t(
            `
          This list represents all Debug Information Files which are not assigned to an
          app version. We will still find these debug symbols for symbolication
          but we can't tell you which versions they belong to.  This happens
          if you upload them with an old verison of sentry-cli or if sentry-cli
          can't locate the Info.plist file at the time of upload.
        `
          )}
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>{t('UUID')}</th>
              <th>{t('Object')}</th>
              <th>{t('Type')}</th>
              <th>{t('Uploaded')}</th>
              <th>{t('Size')}</th>
            </tr>
          </thead>
          <tbody>
            {this.renderDsyms(this.state.unreferencedDebugSymbols, true)}
          </tbody>
        </table>
      </div>
    );
  },

  render() {
    return (
      <div>
        <h1>{t('Debug Information Files')}</h1>
        <p>{t(`
          Here you can find uploaded debug information (for instance debug
          symbol files or proguard mappings).  This is used to convert
          addresses and minified function names from crash dumps
          into function names and locations.  For JavaScript debug support
          look at releases instead.
        `)}</p>
        {this.renderDebugTable()}
        {this.renderUnreferencedDebugSymbols()}
        <Modal
          show={this.state.showModal}
          onHide={this.closeModal}
          animation={false}
          backdrop="static"
          enforceFocus={false}
          bsSize="lg">
          <Modal.Header closeButton>
            <Modal.Title>
              {this.state.activeVersion} ({this.state.activeBuild})
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('UUID')}</th>
                  <th>{t('Object')}</th>
                  <th>{t('Type')}</th>
                  <th>{t('Uploaded')}</th>
                  <th>{t('Size')}</th>
                </tr>
              </thead>
              <tbody>
                {this.renderDsyms(this.state.activeDsyms)}
              </tbody>
            </table>
          </Modal.Body>
        </Modal>
      </div>
    );
  }
});

export default ProjectDebugSymbols;
