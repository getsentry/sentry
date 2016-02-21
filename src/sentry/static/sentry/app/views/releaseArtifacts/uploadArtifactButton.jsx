import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';

import {TextField} from '../../components/forms';

import ApiMixin from '../../mixins/apiMixin';
import IndicatorStore from '../../stores/indicatorStore';

import {t} from '../../locale';

const UploadArtifactButton = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    version: React.PropTypes.string.isRequired,
    onUpload: React.PropTypes.func.isRequired
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      modalVisible: false
    };
  },

  handleButton() {
    this.setState({
      modalVisible: true
    });
  },

  handleSubmit(e) {
    e.preventDefault();

    let formData = new FormData(this.refs.form);

    let loadingIndicator = IndicatorStore.add(t('Uploading artifact..'));

    let {orgId, projectId, version} = this.props;
    this.api.request(`/projects/${orgId}/${projectId}/releases/${version}/files/`, {
      method: 'POST',
      data: formData,
      // disable jQuery data processing to use native XHR2 multipart uploading
      processData: false,
      contentType: false,
      success: (data) => {
        this.props.onUpload(data);
        IndicatorStore.add(t('Artifact uploaded.'), 'success', {
          duration: 4000
        });
      },
      error: () => {
        IndicatorStore.add(t('Unable to upload artifact. Please try again.'), 'error', {
          duration: 4000
        });
      },
      complete: () => {
        this.setState({
          modalVisible: false
        });
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  render() {
    return (
      <a className="btn btn-sm btn-default" onClick={this.handleButton}>
        <span className="icon icon-plus"/> &nbsp;<span style={{textTransform:'none'}}>{t('Upload')}</span>
        <Modal show={this.state.modalVisible} title={t('Please confirm')} animation={false} onHide={function(){}}>
          <form ref="form" onSubmit={this.handleSubmit} encType="multipart/form-data">
            <div className="modal-header">
              <h4>{t('Upload Artifact')}</h4>
            </div>

            <div className="modal-body">
              <TextField
                key="name"
                name="name"
                label={t('Name')}
                placeholder="http://example.org/static/js/app.js.map"
                required={true}/>
              <input ref="file" type="file" name="file" onChange={this.handleFile}/>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-default"
                      onClick={this.setState.bind(this, {modalVisible: false})}>{t('Cancel')}</button>
              <button type="submit" className="btn btn-primary">{t('Save')}</button>
            </div>
          </form>
        </Modal>
      </a>
    );
  }
});

export default UploadArtifactButton;
