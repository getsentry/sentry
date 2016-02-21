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
      modalVisible: false,
      file: null,
      name: '',
      isSaveEnabled: false
    };
  },

  handleButton() {
    this.setState({
      modalVisible: true
    });
  },

  handleNameChange(name) {
    this.setState({
      name: name,
      isSaveEnabled: name && this.state.file
    });
  },

  handleFileChange(e) {
    let file = e.target.files[0];
    this.setState({
      file: file,
      isSaveEnabled: file && this.state.name
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
    let saveButtonProps = {};
    if (!this.state.isSaveEnabled)
      saveButtonProps.disabled = 'disabled';

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
                required={true}
                onChange={this.handleNameChange}
              />

              <div className="control-group">
                <div className="controls">
                  <input ref="file" type="file" name="file" onChange={this.handleFileChange}/>
                </div>
              </div>

              <p><em>Artifacts have a max filesize of <strong>20 MB</strong>.</em></p>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-default"
                      onClick={this.setState.bind(this, {modalVisible: false})}>{t('Cancel')}</button>
              <button type="submit" className="btn btn-primary" {...saveButtonProps}>{t('Save')}</button>
            </div>
          </form>
        </Modal>
      </a>
    );
  }
});

export default UploadArtifactButton;
