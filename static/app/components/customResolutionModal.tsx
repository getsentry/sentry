import * as React from 'react';
import {components as selectComponents} from 'react-select';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import {SelectAsyncField} from 'sentry/components/deprecatedforms';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Release} from 'sentry/types';

type Props = ModalRenderProps & {
  onSelected: ({inRelease: string}) => void;
  orgSlug: string;
  projectSlug?: string;
};

type State = {
  version: string;
};

function VersionOption({
  data,
  ...props
}: React.ComponentProps<typeof selectComponents.Option>) {
  const release = data.release as Release;
  return (
    <selectComponents.Option data={data} {...props}>
      <strong>
        <Version version={release.version} anchor={false} />
      </strong>
      <br />
      <small>
        {t('Created')} <TimeSince date={release.dateCreated} />
      </small>
    </selectComponents.Option>
  );
}

class CustomResolutionModal extends React.Component<Props, State> {
  state: State = {
    version: '',
  };

  onChange = (value: string | number | boolean) => {
    this.setState({version: value as string}); // TODO(ts): Add select value type as generic to select controls
  };

  onAsyncFieldResults = (results: Release[]) =>
    results.map(release => ({
      value: release.version,
      label: release.version,
      release,
    }));

  render() {
    const {orgSlug, projectSlug, closeModal, onSelected, Header, Body, Footer} =
      this.props;
    const url = projectSlug
      ? `/projects/${orgSlug}/${projectSlug}/releases/`
      : `/organizations/${orgSlug}/releases/`;

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
            label={t('Version')}
            id="version"
            name="version"
            onChange={this.onChange}
            placeholder={t('e.g. 1.0.4')}
            url={url}
            onResults={this.onAsyncFieldResults}
            onQuery={query => ({query})}
            components={{
              Option: VersionOption,
            }}
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
