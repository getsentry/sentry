import React from 'react';
import styled from '@emotion/styled';
import {components} from 'react-select';

import InputField from 'app/views/settings/components/forms/inputField';
import {ProjectMapperType} from 'app/views/settings/components/forms/type';
import SelectControl from 'app/components/forms/selectControl';
import IdBadge from 'app/components/idBadge';
import Button from 'app/components/button';
import {IconJira, IconDelete} from 'app/icons';
import {t} from 'app/locale';

type MappedValue = string | number;

type Props = InputField['props'];
type RenderProps = Props & ProjectMapperType;

type State = {
  selectedSentryProjectId: number | null;
  selectedMappedValue: MappedValue | null;
};

export class RenderField extends React.Component<RenderProps, State> {
  state: State = {selectedSentryProjectId: null, selectedMappedValue: null};

  render() {
    const {
      onChange,
      onBlur,
      value: incomingValues,
      sentryProjects,
      mappedDropdown: {items: mappedDropdownItems, placeholder: mappedValuePlaceholder},
    } = this.props;
    const existingValues: Array<[number, MappedValue]> = incomingValues || [];

    const {selectedSentryProjectId, selectedMappedValue} = this.state;

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

    const handleSelectProject = ({value}: {value: number}) => {
      this.setState({selectedSentryProjectId: value});
    };

    const handleSelectMappedValue = ({value}: {value: MappedValue}) => {
      this.setState({selectedMappedValue: value});
    };

    const handleAdd = () => {
      //add the new value to the list of existing values
      const projectMappings = [
        ...existingValues,
        [selectedSentryProjectId, selectedMappedValue],
      ];
      //trigger events so we save the value and show the check mark
      onChange?.(projectMappings, []);
      onBlur?.(projectMappings, []);
      this.setState({selectedSentryProjectId: null, selectedMappedValue: null});
    };

    const handleDelete = (index: number) => {
      const projectMappings = existingValues
        .slice(0, index)
        .concat(existingValues.slice(index + 1));
      //trigger events so we save the value and show the check mark
      onChange?.(projectMappings, []);
      onBlur?.(projectMappings, []);
    };

    const renderItem = (itemTuple: [number, any], index: number) => {
      const [projectId, mappedValue] = itemTuple;
      const project = sentryProjectsById[projectId];
      // TODO: add special formatting if deleted
      const mappedItem = mappedItemsByValue[mappedValue];
      return (
        <Item key={index}>
          {project ? (
            <StyledIdBadge
              project={project}
              avatarSize={20}
              displayName={project.slug}
              avatarProps={{consistentWidth: true}}
            />
          ) : (
            <ItemValue>Deleted</ItemValue>
          )}
          <MappedItemValue>
            {mappedItem ? (
              <React.Fragment>
                <StyledVercelIcon />
                {mappedItem.label}
              </React.Fragment>
            ) : (
              'Deleted'
            )}
          </MappedItemValue>
          <DeleteButton
            onClick={() => handleDelete(index)}
            icon={<IconDelete color="gray500" />}
            size="small"
            type="button"
          />
        </Item>
      );
    };

    const customValueContainer = containerProps => {
      //if no value set, we want to return the default component that is rendered
      const project = sentryProjectsById[selectedSentryProjectId || ''];
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

    const customMappedValueContainer = containerProps => {
      //if no value set, we want to return the default component that is rendered
      const mappedValue = mappedItemsByValue[selectedMappedValue || ''];
      if (!mappedValue) {
        return <components.ValueContainer {...containerProps} />;
      }
      return (
        <components.ValueContainer {...containerProps}>
          <StyledVercelIcon />
          {mappedValue.label}
        </components.ValueContainer>
      );
    };

    const customOptionMappedValue = optionProps => {
      return (
        <components.Option {...optionProps}>
          <StyledVercelIcon />
          {optionProps.label}
        </components.Option>
      );
    };

    return (
      <Wrapper>
        {existingValues.map(renderItem)}
        <Item>
          <StyledSelectControl
            placeholder={t('Choose Vercel ')}
            name="project"
            openMenuOnFocus
            options={projectOptions}
            components={{
              Option: customOptionProject,
              ValueContainer: customValueContainer,
            }}
            onChange={handleSelectProject}
            value={selectedSentryProjectId}
          />
          <StyledSelectControl
            placeholder={mappedValuePlaceholder}
            name="mappedDropdown"
            openMenuOnFocus
            options={mappedItemsToShow}
            components={{
              Option: customOptionMappedValue,
              ValueContainer: customMappedValueContainer,
            }}
            onChange={handleSelectMappedValue}
            value={selectedMappedValue}
          />
          <StyledAddProjectButton
            disabled={!selectedSentryProjectId || !selectedMappedValue}
            type="button"
            size="small"
            priority="primary"
            onClick={handleAdd}
          >
            Add Project
          </StyledAddProjectButton>
        </Item>
      </Wrapper>
    );
  }
}

const ProjectMapperField = (props: Props) => (
  <InputField
    {...props}
    resetOnError
    inline={false}
    field={(renderProps: RenderProps) => <RenderField {...renderProps} />}
  />
);

export default ProjectMapperField;

const StyledSelectControl = styled(SelectControl)`
  width: 265px;
  margin-left: 15px;
`;

const Wrapper = styled('div')``;

const Item = styled('div')`
  margin-top: -1px;
  border: 1px solid ${p => p.theme.gray400};
  display: flex;
  align-items: center;
  height: 60px;
`;

const ItemValue = styled('div')`
  padding: 5px;
  margin-left: 20px;
`;

const MappedItemValue = styled('div')`
  padding: 5px;
  position: absolute;
  left: 300px;
`;

const DeleteButton = styled(Button)`
  position: absolute;
  right: 20px;
`;

const StyledIdBadge = styled(IdBadge)`
  margin-left: 20px;
`;

const StyledVercelIcon = styled(IconJira)`
  margin-right: 8px;
`;

const StyledAddProjectButton = styled(Button)`
  margin-left: 15px;
`;
