import {useEffect, useState} from 'react';

import type {APIRequestMethod} from 'sentry/api';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import FormModel, {type FormOptions} from 'sentry/components/forms/model';
import type {Project} from 'sentry/types/project';

interface Props {
  updateProject: (data: Partial<Project>) => Promise<unknown>;
  updateProjectSeerPreferences: (
    data: Partial<ProjectSeerPreferences>
  ) => Promise<unknown>;
}

export default function useSeerSettingsFormModel({
  updateProject,
  updateProjectSeerPreferences,
}: Props) {
  const [formModel] = useState(
    () => new SeerSettingsFormModel({}, {updateProject, updateProjectSeerPreferences})
  );

  useEffect(() => {
    formModel.updateProject = updateProject;
    formModel.updateProjectSeerPreferences = updateProjectSeerPreferences;
  }, [formModel, updateProject, updateProjectSeerPreferences]);

  return formModel;
}

class SeerSettingsFormModel extends FormModel {
  public updateProject: Props['updateProject'];
  public updateProjectSeerPreferences: Props['updateProjectSeerPreferences'];

  constructor(
    options: FormOptions,
    {
      updateProject,
      updateProjectSeerPreferences,
    }: Pick<Props, 'updateProject' | 'updateProjectSeerPreferences'>
  ) {
    super(options);
    this.updateProject = updateProject;
    this.updateProjectSeerPreferences = updateProjectSeerPreferences;
  }

  doApiRequest({
    apiEndpoint,
    apiMethod,
    data,
  }: {
    data: Record<PropertyKey, unknown>;
    apiEndpoint?: string;
    apiMethod?: APIRequestMethod;
  }) {
    if ('autofixAutomationTuning' in data) {
      return this.updateProject(data);
    }

    if ('automated_run_stopping_point' in data) {
      return this.updateProjectSeerPreferences(data);
    }

    return super.doApiRequest({
      apiEndpoint,
      apiMethod,
      data,
    });
  }
}
