import React from 'react';
import styled from '@emotion/styled';
import {components} from 'react-select';

import InputField from 'app/views/settings/components/forms/inputField';
import {ProjectMapperType} from 'app/views/settings/components/forms/type';
import SelectControl from 'app/components/forms/selectControl';
import IdBadge from 'app/components/idBadge';
import Button from 'app/components/button';
import {IconAdd} from 'app/icons';
import {t} from 'app/locale';

type Props = InputField['props'];
type RenderProps = Props & ProjectMapperType;

export class RenderField extends React.Component<RenderProps> {
  sentryProjectRef = React.createRef<typeof SelectControl>();
  mappedRef = React.createRef<typeof SelectControl>();

  render() {
    const {
      onChange,
      onBlur,
      value,
      mappedDropdown,
      sentryProjects,
      mappedDropdown: {items: mappedDropdownItems},
    } = this.props;
    const existingValues: Array<[number, string | number]> = value || [];

    // create maps by the project id for constant time lookups
    const sentryProjectsById = Object.fromEntries(
      sentryProjects.map(project => [project.id, project])
    );

    const mappedItemsByValue = Object.fromEntries(
      mappedDropdownItems.map(item => [item.value, item])
    );

    //build sets of values used so we don't let the user select them twice
    const projectIdsUsed = new Set(existingValues.map(tuple => tuple[0]));
    const mappedValuesUsed = new Set(existingValues.map(tuple => tuple[1]));

    const projectOptions = sentryProjects
      .filter(project => !projectIdsUsed.has(project.id))
      .map(({slug, id}) => ({label: slug, value: id}));

    const mappedItemsToShow = mappedDropdownItems.filter(
      item => !mappedValuesUsed.has(item.value)
    );

    const handleAdd = () => {
      const {value: sentryProjectId} = this.sentryProjectRef.current.state.value;
      const {value: mappedValue} = this.mappedRef.current.state.value;
      //add the new value to the list of existing values
      const projectMappings = [...existingValues, [sentryProjectId, mappedValue]];
      //trigger events so we save the value and show the check mark
      onChange?.(projectMappings, []);
      onBlur?.(projectMappings, []);
    };

    const renderItem = (itemTuple: [number, any]) => {
      const [projectId, mappedValue] = itemTuple;
      const {slug} = sentryProjectsById[projectId];
      const {label: itemLabel} = mappedItemsByValue[mappedValue];
      return (
        <Item key={projectId}>
          <ItemValue>{slug}</ItemValue> <ItemValue>{itemLabel}</ItemValue>
        </Item>
      );
    };

    const customValueContainer = containerProps => {
      const valueList = containerProps.getValue();
      //if no value set, we want to return the default component that is rendered
      if (valueList.length === 0) {
        return <components.ValueContainer {...containerProps} />;
      }
      const projectId = valueList[0].value;
      const project = sentryProjectsById[projectId];
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

    const customOptionProject = projectProps => {
      const project = sentryProjectsById[projectProps.value];
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

    return (
      <Wrapper>
        {existingValues.map(renderItem)}
        <SelectContainer>
          <StyledSelectControl
            placeholder={t('Select a Project')}
            name="project"
            openMenuOnFocus
            options={projectOptions}
            components={{
              Option: customOptionProject,
              ValueContainer: customValueContainer,
            }}
            ref={this.sentryProjectRef}
          />
          <StyledSelectControl
            placeholder={mappedDropdown.placeholder}
            name="mappedDropwdown"
            openMenuOnFocus
            options={mappedItemsToShow}
            ref={this.mappedRef}
          />
          <Button
            type="button"
            size="small"
            label={t('Add')}
            icon={<IconAdd />}
            onClick={handleAdd}
          />
        </SelectContainer>
      </Wrapper>
    );
  }
}

const ProjectMapperField = (props: Props) => (
  <InputField
    {...props}
    field={(renderProps: RenderProps) => <RenderField {...renderProps} />}
  />
);

export default ProjectMapperField;

const StyledSelectControl = styled(SelectControl)`
  width: 50%;
`;

const SelectContainer = styled('div')`
  display: flex;
`;

const Wrapper = styled('div')``;

const Item = styled('div')`
  padding: 5px;
`;

const ItemValue = styled('span')`
  padding: 5px;
`;
