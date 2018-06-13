import PropTypes from 'prop-types';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import jQuery from 'jquery';
import Modal from 'react-bootstrap/lib/Modal';
import underscore from 'lodash';

import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';

import {SelectAutocompleteField} from 'app/components/forms';
import {t} from 'app/locale';

export default class CustomResolutionModal extends React.Component {
  static propTypes = {
    onSelected: PropTypes.func.isRequired,
    onCanceled: PropTypes.func.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    show: PropTypes.bool,
  };

  constructor(...args) {
    super(...args);
    this.state = {version: ''};
  }

  componentDidUpdate(prevProps, prevState) {
    if (!prevProps.show && this.props.show) {
      // XXX(cramer): this is incorrect but idgaf
      jQuery('.modal').attr('tabindex', null);
    }
  }

  onSubmit = () => {
    this.props.onSelected({
      inRelease: this.state.version,
    });
  };

  onChange = value => {
    this.setState({version: value});
  };

  render() {
    let {orgId, projectId} = this.props;
    let {version} = this.state;

    return (
      <Modal show={this.props.show} animation={false} onHide={this.props.onCanceled}>
        <div className="modal-header">
          <h4>{t('Resolved In')}</h4>
        </div>
        <div className="modal-body">
          <form className="m-b-1">
            <div className="control-group m-b-1">
              <h6 className="nav-header">{t('Version')}</h6>
              <SelectAutocompleteField
                name="version"
                onChange={v => this.onChange(v)}
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
                      <small>
                        Created <TimeSince date={release.dateCreated} />
                      </small>
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
            onClick={this.props.onCanceled}
          >
            {t('Cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={this.onSubmit}>
            {t('Save Changes')}
          </button>
        </div>
      </Modal>
    );
  }
}
