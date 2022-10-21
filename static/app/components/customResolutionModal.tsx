import {Fragment, useState} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import SelectAsyncField from 'sentry/components/deprecatedforms/selectAsyncField';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import configStore from 'sentry/stores/configStore';
import space from 'sentry/styles/space';
import type {Release} from 'sentry/types';

interface CustomResolutionModalProps extends ModalRenderProps {
  onSelected: (change: {inRelease: string}) => void;
  orgSlug: string;
  projectSlug?: string;
}

function CustomResolutionModal(props: CustomResolutionModalProps) {
  const [version, setVersion] = useState('');
  const currentUser = configStore.get('user');

  const onChange = (value: any) => {
    setVersion(value.item);
  };

  const onAsyncFieldResults = (results: Release[]) => {
    return results.map(release => {
      const isAuthor = release.authors.some(
        author => author.email && author.email === currentUser?.email
      );
      return {
        item: release.version,
        label: <Version version={release.version} anchor={false} />,
        details: (
          <span>
            {t('Created')} <TimeSince date={release.dateCreated} />
            {isAuthor ? <Fragment> — {t('You committed')}</Fragment> : null}
          </span>
        ),
        release,
      };
    });
  };

  const url = props.projectSlug
    ? `/projects/${props.orgSlug}/${props.projectSlug}/releases/`
    : `/organizations/${props.orgSlug}/releases/`;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    props.onSelected({inRelease: version});
    props.closeModal();
  };

  const {Header, Body, Footer} = props;

  return (
    <form onSubmit={onSubmit}>
      <Header>
        <h4>{t('Resolved In')}</h4>
      </Header>
      <Body>
        <SelectAsyncField
          label={t('Version')}
          id="version"
          name="version"
          onChange={onChange}
          placeholder={t('e.g. 1.0.4')}
          url={url}
          onResults={onAsyncFieldResults}
          onQuery={query => ({query})}
        />
      </Body>
      <Footer>
        <Button type="button" css={{marginRight: space(1.5)}} onClick={props.closeModal}>
          {t('Cancel')}
        </Button>
        <Button type="submit" priority="primary">
          {t('Save Changes')}
        </Button>
      </Footer>
    </form>
  );
}

export default CustomResolutionModal;
