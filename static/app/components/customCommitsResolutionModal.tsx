import React, {useState} from 'react';

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

function CustomCommitsResolutionModal({
  onSelected,
  orgSlug,
  projectSlug,
  closeModal,
  Header,
  Body,
  Footer,
}: Props) {
  const [commit, setCommit] = useState<{commit: Commit | undefined}>({commit: undefined});
  const [commits, setCommits] = useState<{commits: Commit[] | undefined}>({
    commits: undefined,
  });

  const onChange = (value: string | number | boolean) => {
    if (commits === undefined) {
      return;
    }
    setCommit({
      commit: commits.commits?.find(result => result.id === value),
    });
  };

  const onAsyncFieldResults = (results: Commit[]) => {
    setCommits({
      commits: results,
    });
    return results.map(c => ({
      value: c.id,
      label: <Version version={c.id} anchor={false} />,
      details: (
        <span>
          {t('Created')} <TimeSince date={c.dateCreated} />
        </span>
      ),
      c,
    }));
  };

  const url = `/projects/${orgSlug}/${projectSlug}/commits/`;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSelected({
      inCommit: {
        commit: commit.commit?.id,
        repository: commit.commit?.repository?.name,
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
          onChange={onChange}
          placeholder={t('e.g. 1.0.4')}
          url={url}
          onResults={onAsyncFieldResults}
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

export default CustomCommitsResolutionModal;
