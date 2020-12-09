import React from 'react';
import PropTypes from 'prop-types';

import {ModalRenderProps} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import {SelectAsyncField} from 'app/components/forms';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Release} from 'app/types';

type Props = ModalRenderProps & {
  onSelected: ({inRelease: string}) => void;
  orgId: string;
  projectId?: string;
};

type State = {
  version: string;
};

class CustomResolutionModal extends React.Component<Props, State> {
  static propTypes = {
    onSelected: PropTypes.func.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string,
  };

  state = {
    version: '',
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
    const {orgId, projectId, closeModal, onSelected, Header, Body, Footer} = this.props;
    const url = projectId
      ? `/projects/${orgId}/${projectId}/releases/`
      : `/organizations/${orgId}/releases/`;

    const onSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSelected({inRelease: this.state.version});
      closeModal();
    };

    return (
      <form onSubmit={onSubmit}>
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
            onResults={this.onAsyncFieldResults}
            onQuery={query => ({query})}
          />
        </Body>
        <Footer>
          <Button type="button" css={{marginRight: space(1.5)}} onClick={closeModal}>
            {t('Cancel')}
          </Button>
          <Button type="submit" priority="primary">
            {t('Save Changes')}
          </Button>
        </Footer>
      </form>
    );
  }
}

export default CustomResolutionModal;
