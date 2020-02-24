import $ from 'jquery';
import Modal, {Header, Body, Footer} from 'react-bootstrap/lib/Modal';
import PropTypes from 'prop-types';
import React from 'react';

import {SelectAsyncField} from 'app/components/forms';
import {t} from 'app/locale';
import Button from 'app/components/button';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import {Release} from 'app/types';
import space from 'app/styles/space';

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

  componentDidUpdate(prevProps) {
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

  onChange = (value: string) => {
    this.setState({version: value});
  };

  render() {
    const {orgId, projectId, show, onCanceled} = this.props;
    const url = projectId
      ? `/projects/${orgId}/${projectId}/releases/`
      : `/organizations/${orgId}/releases/`;

    return (
      <Modal show={show} animation={false} onHide={onCanceled}>
        <form onSubmit={this.onSubmit}>
          <Header>{t('Resolved In')}</Header>
          <Body>
            <SelectAsyncField
              deprecatedSelectControl
              label={t('Version')}
              id="version"
              name="version"
              onChange={this.onChange}
              placeholder={t('e.g. 1.0.4')}
              url={url}
              onResults={(results: Release[]) => {
                return results.map(release => ({
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
              }}
              onQuery={query => ({query})}
            />
          </Body>
          <Footer>
            <Button
              type="button"
              css={{marginRight: space(1.5)}}
              onClick={this.props.onCanceled}
            >
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

export default CustomResolutionModal;
