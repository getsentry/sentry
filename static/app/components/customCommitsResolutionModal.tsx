import {useState} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import SelectAsyncField from 'sentry/components/deprecatedforms/selectAsyncField';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Commit, ResolvedStatusDetails} from 'sentry/types';

interface CustomCommitsResolutionModalProps extends ModalRenderProps {
  onSelected: (x: ResolvedStatusDetails) => void;
  orgSlug: string;
  projectSlug?: string;
}

function CustomCommitsResolutionModal({
  onSelected,
  orgSlug,
  projectSlug,
  closeModal,
  Header,
  Body,
  Footer,
}: CustomCommitsResolutionModalProps) {
  const [commit, setCommit] = useState<Commit | undefined>();
  const [commits, setCommits] = useState<Commit[] | undefined>();

  const onChange = (value: string | number | boolean) => {
    setCommit(commits?.find(result => result.id === value));
  };

  const onAsyncFieldResults = (results: Commit[]) => {
    setCommits(results);
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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSelected({
      inCommit: {
        commit: commit?.id,
        repository: commit?.repository?.name,
      },
    });
    closeModal();
  };

  return (
    <form onSubmit={onSubmit}>
      <Header>
        <h4>{t('Resolved In')}</h4>
      </Header>
      <Body>
        <SelectAsyncField
          label={t('Commit')}
          id="commit"
          name="commit"
          onChange={onChange}
          placeholder={t('e.g. d86b832')}
          url={`/projects/${orgSlug}/${projectSlug}/commits/`}
          onResults={onAsyncFieldResults}
          onQuery={query => ({query})}
        />
      </Body>
      <Footer>
        <Button css={{marginRight: space(1.5)}} onClick={closeModal}>
          {t('Cancel')}
        </Button>
        <Button type="submit" priority="primary">
          {t('Resolve')}
        </Button>
      </Footer>
    </form>
  );
}

export default CustomCommitsResolutionModal;
