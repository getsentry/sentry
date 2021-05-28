import {Client} from 'app/api';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';

import Card from '../card';
import CardItem from '../cardItem';
import {ItunesCredentialsData} from '../types';

import Form from './form';

type Props = {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  isUpdating: boolean;
  isEditing: boolean;
  data: ItunesCredentialsData;
  onChange: (data: ItunesCredentialsData) => void;
  onEdit: (isEditing: boolean) => void;
  onReset: () => void;
};

function ItunesCredentials({
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
      {data.username && <CardItem label={t('User')} value={data.username} />}
      {data.org?.name && (
        <CardItem label={t('iTunes Organization')} value={data.org?.name} />
      )}
    </Card>
  );
}

export default ItunesCredentials;
