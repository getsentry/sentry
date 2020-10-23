import React from 'react';
import styled from '@emotion/styled';
import {components} from 'react-select';

import {Client} from 'app/api';
import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {IconDelete, IconEdit} from 'app/icons';
import QuestionTooltip from 'app/components/questionTooltip';
import space from 'app/styles/space';
import Tooltip from 'app/components/tooltip';
import IdBadge from 'app/components/idBadge';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import Field from 'app/views/settings/components/forms/field';
import SelectControl from 'app/components/forms/selectControl';
import SelectField from 'app/views/settings/components/forms/selectField';
import {Project, Organization, Integration} from 'app/types';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

type Props = {
  projects: Project[];
  organization: Organization;
  integration: Integration;
};

export default class RepositoryProjectPathConfigForm extends React.Component<Props> {
  api = new Client();

  get formFields(): JsonFormObject {
    return {
      title: 'test',
      fields: [
        {
          name: 'stackRoot',
          type: 'string',
          required: false,
          label: 'Input Path',
          help: 'My help',
        },
      ],
    };
  }

  render() {
    const {organization, integration, projects} = this.props;
    const endpoint = `/organizations/${organization.slug}/integrations/${integration.id}/repo-project-path-configs/`;

    // const projectOptions = projects.map(({slug, id}) => ([{label: slug, value: id})]);
    const projectOptions = projects.map(({slug, id}) => [id, slug]);

    const customOptionProject = projectProps => {
      const project = projects.find(proj => proj.id === projectProps.value);
      //Should never happen for a dropdown item
      if (!project) {
        return null;
      }
      return (
        <components.Option {...projectProps}>
          <IdBadge
            project={project}
            avatarSize={20}
            displayName={project.slug}
            avatarProps={{consistentWidth: true}}
          />
        </components.Option>
      );
    };

    const customValueContainer = containerProps => {
      const selectedValue = containerProps.getValue()[0];
      const project = projects.find(proj => proj.id === selectedValue?.value);
      if (!project) {
        return <components.ValueContainer {...containerProps} />;
      }
      return (
        <components.ValueContainer {...containerProps}>
          <IdBadge
            project={project}
            avatarSize={20}
            displayName={project.slug}
            avatarProps={{consistentWidth: true}}
          />
        </components.ValueContainer>
      );
    };

    return (
      <Form apiEndpoint={endpoint} apiMethod="POST">
        <StyledSelectControl
          placeholder={t('Choose Sentry project\u2026')}
          name="project"
          choices={projectOptions}
          components={{
            Option: customOptionProject,
            ValueContainer: customValueContainer,
          }}
        />
        <JsonForm forms={[this.formFields]} />
      </Form>
    );
  }
}

const StyledSelectControl = styled(SelectField)``;
