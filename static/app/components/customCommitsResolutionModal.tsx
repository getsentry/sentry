import {Component} from 'react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import {SelectAsyncField} from 'sentry/components/deprecatedforms';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Commit} from 'sentry/types';

type Props = ModalRenderProps & {
  onSelected: ({inCommit: string}) => void;
  orgSlug: string;
  projectSlug?: string;
};

type State = {
  commit: Commit | undefined;
  commits: Commit[] | undefined;
};

class CustomCommitsResolutionModal extends Component<Props, State> {
  state: State = {
    commit: undefined,
    commits: undefined,
  };

  onChange = (value: string | number | boolean) => {
    const commits = this.state.commits;
    if (commits === undefined) {
      return;
    }
    this.setState({
      commit: commits.find(result => result.id === value),
    });
  };

  onAsyncFieldResults = (results: Commit[]) => {
    this.setState({commits: results});
    return results.map(commit => ({
      value: commit.id,
      label: <Version version={commit.id} anchor={false} />,
      details: (
        <span>
          {t('Created')} <TimeSince date={commit.dateCreated} />
        </span>
      ),
      commit,
    }));
  };

  render() {
    const {orgSlug, projectSlug, closeModal, onSelected, Header, Body, Footer} =
      this.props;
    const url = `/projects/${orgSlug}/${projectSlug}/commits/`;

    const onSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSelected({
        inCommit: {
          commit: this.state.commit?.id,
          repository: this.state.commit?.repository?.name,
        },
      });
      closeModal();
    };

    return (
      <form onSubmit={onSubmit}>
        <Header>{t('Resolved In')}</Header>
        <Body>
          <SelectAsyncField
            label={t('Commit')}
            id="commit"
            name="commit"
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

export default CustomCommitsResolutionModal;
