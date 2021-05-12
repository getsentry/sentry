import {useState} from 'react';

import {Client} from 'app/api';
import {Organization, Project} from 'app/types';

import Card from '../card';
import {AppStoreCredentialsData} from '../types';

import Form from './form';

type Props = {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  isUpdating: boolean;
  data: AppStoreCredentialsData;
  onChange: (data: AppStoreCredentialsData) => void;
};

function AppStoreCredentials({data, isUpdating, ...props}: Props) {
  const [isEditing, setIsEditing] = useState(!isUpdating);

  if (isEditing) {
    return (
      <Form
        {...props}
        data={data}
        onCancel={isUpdating ? () => setIsEditing(false) : undefined}
      />
    );
  }

  return <Card data={data} onDelete={() => setIsEditing(true)} />;
}

export default AppStoreCredentials;
