import {Client} from 'app/api';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';

import Card from '../card';
import CardItem from '../cardItem';
import {AppStoreCredentialsData} from '../types';

import Form from './form';

type Props = {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  isUpdating: boolean;
  isEditing: boolean;
  data: AppStoreCredentialsData;
  onChange: (data: AppStoreCredentialsData) => void;
  onEdit: (isEditing: boolean) => void;
  onReset: () => void;
};

function AppStoreCredentials({
  data,
  isUpdating,
  onReset,
  isEditing,
  onEdit,
  ...props
}: Props) {
  function handleSwitchToReadMode() {
    onEdit(false);
  }

  function handleCancel() {
    onEdit(false);
    onReset();
  }

  if (isEditing) {
    return (
      <Form
        {...props}
        data={data}
        onSwitchToReadMode={handleSwitchToReadMode}
        onCancel={isUpdating ? handleCancel : undefined}
      />
    );
  }

  return (
    <Card onEdit={() => onEdit(true)}>
      {data.issuer && <CardItem label={t('Issuer')} value={data.issuer} />}
      {data.keyId && <CardItem label={t('Key Id')} value={data.keyId} />}
      {data.app?.name && (
        <CardItem label={t('App Store Connect Application')} value={data.app?.name} />
      )}
    </Card>
  );
}

export default AppStoreCredentials;
