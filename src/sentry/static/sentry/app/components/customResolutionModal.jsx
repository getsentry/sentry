import React from 'react';
import ReactDOMServer from 'react-dom/server';
import jQuery from 'jquery';
import Modal from 'react-bootstrap/lib/Modal';
import underscore from 'lodash';

import TimeSince from './timeSince';
import Version from './version';

import {Select2FieldAutocomplete} from './forms';
import {t} from '../locale';

export default React.createClass({
  propTypes: {
    onSelected: React.PropTypes.func.isRequired,
    onCanceled: React.PropTypes.func.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    show: React.PropTypes.bool
  },

  getInitialState() {
    return {version: ''};
  },

  componentDidUpdate(prevProps, prevState) {
    if (!prevProps.show && this.props.show) {
      // XXX(cramer): this is incorrect but idgaf
      jQuery('.modal').attr('tabindex', null);
    }
  },

  onSubmit() {
    this.props.onSelected({
      inRelease: this.state.version
    });
  },

  onChange(value) {
    this.setState({version: value});
  },

  render() {
    let {orgId, projectId} = this.props;
    let {version} = this.state;

    return (
      <Modal show={this.props.show} animation={false} onHide={this.props.onCanceled}>
        <div className="modal-header">
          <h4>Resolved In</h4>
        </div>
        <div className="modal-body">
          <form className="m-b-1">
            <div className="control-group m-b-1">
              <h6 className="nav-header">Version</h6>
              <Select2FieldAutocomplete
                name="version"
                className="form-control"
                onChange={v => this.onChange(v)}
                style={{padding: '3px 10px'}}
                placeholder={t('e.g. 1.0.4')}
                url={`/api/0/projects/${orgId}/${projectId}/releases/`}
                value={version}
                id={'version'}
                onResults={results => {
                  return {results};
                }}
                onQuery={query => {
                  return {query};
                }}
                formatResult={release => {
                  return ReactDOMServer.renderToStaticMarkup(
                    <div>
                      <strong>
                        <Version version={release.version} anchor={false} />
                      </strong>
                      <br />
                      <small>Created <TimeSince date={release.dateCreated} /></small>
                    </div>
                  );
                }}
                formatSelection={item => underscore.escape(item.version)}
                escapeMarkup={false}
              />
            </div>
          </form>
        </div>
        <div className="modal-footer m-t-1">
          <button
            type="button"
            className="btn btn-default"
            onClick={this.props.onCanceled}>
            {t('Cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={this.onSubmit}>
            {t('Save Changes')}
          </button>
        </div>
      </Modal>
    );
  }
});
