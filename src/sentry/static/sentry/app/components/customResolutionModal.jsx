import $ from 'jquery';
import Modal, {Header, Body, Footer} from 'react-bootstrap/lib/Modal';
import PropTypes from 'prop-types';
import React from 'react';

import {SelectAsyncField} from 'app/components/forms';
import {t} from 'app/locale';
import Button from 'app/components/button';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';

export default class CustomResolutionModal extends React.Component {
  static propTypes = {
    onSelected: PropTypes.func.isRequired,
    onCanceled: PropTypes.func.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string,
    show: PropTypes.bool,
  };

  constructor(...args) {
    super(...args);
    this.state = {version: ''};
  }

  componentDidUpdate(prevProps, prevState) {
    if (!prevProps.show && this.props.show) {
      // XXX(cramer): this is incorrect but idgaf
      $('.modal').attr('tabindex', null);
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
    const {orgId, projectId} = this.props;
    const url = projectId
      ? `/projects/${orgId}/${projectId}/releases/`
      : `/organizations/${orgId}/releases/`;

    return (
      <Modal show={this.props.show} animation={false} onHide={this.props.onCanceled}>
        <form onSubmit={this.onSubmit}>
          <Header>{t('Resolved In')}</Header>
          <Body>
            <SelectAsyncField
              label={t('Version')}
              id="version"
              name="version"
              onChange={this.onChange}
              placeholder={t('e.g. 1.0.4')}
              url={url}
              onResults={results => {
                return results.map(release => ({
                  value: release.version,
                  label: (
                    <div>
                      <strong>
                        <Version version={release.version} anchor={false} />
                      </strong>
                      <br />
                      <small>
                        Created <TimeSince date={release.dateCreated} />
                      </small>
                    </div>
                  ),
                }));
              }}
              onQuery={query => ({query})}
            />
          </Body>
          <Footer>
            <Button type="button" css={{marginRight: 10}} onClick={this.props.onCanceled}>
              {t('Cancel')}
            </Button>
            <Button type="submit" priority="primary">
              {t('Save Changes')}
            </Button>
          </Footer>
        </form>
      </Modal>
    );
  }
}
