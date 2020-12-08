import React from 'react';
import {Modal} from 'react-bootstrap';
import PropTypes from 'prop-types';

import Button from 'app/components/button';
import {SelectAsyncField} from 'app/components/forms';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Release} from 'app/types';

type Props = {
  onSelected: ({inRelease: string}) => void;
  onCanceled: () => void;
  orgId: string;
  projectId?: string;
  show?: boolean;
};

type State = {
  version: string;
};

class CustomResolutionModal extends React.Component<Props, State> {
  static propTypes = {
    onSelected: PropTypes.func.isRequired,
    onCanceled: PropTypes.func.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string,
    show: PropTypes.bool,
  };

  state = {
    version: '',
  };

  onSubmit = () => {
    this.props.onSelected({
      inRelease: this.state.version,
    });
  };

  onChange = (value: string) => {
    this.setState({version: value});
  };

  onAsyncFieldResults = (results: Release[]) =>
    results.map(release => ({
      value: release.version,
      label: (
        <div>
          <strong>
            <Version version={release.version} anchor={false} />
          </strong>
          <br />
          <small>
            {t('Created')} <TimeSince date={release.dateCreated} />
          </small>
        </div>
      ),
    }));

  render() {
    const {orgId, projectId, show, onCanceled} = this.props;
    const url = projectId
      ? `/projects/${orgId}/${projectId}/releases/`
      : `/organizations/${orgId}/releases/`;

    return (
      <Modal show={show} animation={false} onHide={onCanceled}>
        <form onSubmit={this.onSubmit}>
          <Modal.Header>{t('Resolved In')}</Modal.Header>
          <Modal.Body>
            <SelectAsyncField
              deprecatedSelectControl
              label={t('Version')}
              id="version"
              name="version"
              onChange={this.onChange}
              placeholder={t('e.g. 1.0.4')}
              url={url}
              onResults={this.onAsyncFieldResults}
              onQuery={query => ({query})}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" css={{marginRight: space(1.5)}} onClick={onCanceled}>
              {t('Cancel')}
            </Button>
            <Button type="submit" priority="primary">
              {t('Save Changes')}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>
    );
  }
}

export default CustomResolutionModal;
