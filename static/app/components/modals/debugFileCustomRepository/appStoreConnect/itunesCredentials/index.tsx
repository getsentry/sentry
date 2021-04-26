import {useState} from 'react';

import {Client} from 'app/api';
import {Organization, Project} from 'app/types';

import Card from '../card';
import {ItunesCredentialsData} from '../types';

import Form from './form';

type Props = {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  isUpdating: boolean;
  data: ItunesCredentialsData;
  onChange: (data: ItunesCredentialsData) => void;
};

function ItunesCredentials({data, isUpdating, ...props}: Props) {
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

export default ItunesCredentials;
