import React from 'react';
import styled from '@emotion/styled';
import {components} from 'react-select';

import space from 'app/styles/space';
import InputField from 'app/views/settings/components/forms/inputField';
import FormFieldControlState from 'app/views/settings/components/forms/formField/controlState';
import FieldErrorReason from 'app/views/settings/components/forms/field/fieldErrorReason';
import FormModel from 'app/views/settings/components/forms/model';
import {ProjectMapperType} from 'app/views/settings/components/forms/type';
import SelectControl from 'app/components/forms/selectControl';
import IdBadge from 'app/components/idBadge';
import Button from 'app/components/button';
import {
  IconVercel,
  IconGeneric,
  IconDelete,
  IconOpen,
  IconAdd,
  IconArrow,
} from 'app/icons';
import ExternalLink from 'app/components/links/externalLink';
import {t} from 'app/locale';
import {removeAtArrayIndex} from 'app/utils/removeAtArrayIndex';
import {safeGetQsParam} from 'app/utils/integrationUtil';
import {PanelAlert} from 'app/components/panels';

type MappedValue = string | number;

type Props = InputField['props'];
type RenderProps = Props & ProjectMapperType & {model: FormModel};

type State = {
  selectedSentryProjectId: number | null;
  selectedMappedValue: MappedValue | null;
};

//Get the icon
const getIcon = (iconType: string) => {
  switch (iconType) {
    case 'vercel':
      return <IconVercel />;
    default:
      return <IconGeneric />;
  }
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
      nextButton: {text: nextButtonText, description: nextDescription, allowedDomain},
      iconType,
      model,
      id: formElementId,
      error,
    } = this.props;
    const existingValues: Array<[number, MappedValue]> = incomingValues || [];
    const nextUrlOrArray = safeGetQsParam('next');
    let nextUrl = Array.isArray(nextUrlOrArray) ? nextUrlOrArray[0] : nextUrlOrArray;

    if (nextUrl && !nextUrl.startsWith(allowedDomain)) {
      // eslint-disable-next-line no-console
      console.warn(`Got unexpected next url: ${nextUrl}`);
      nextUrl = undefined;
    }

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
      const projectMappings = removeAtArrayIndex(existingValues, index);
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
          <MappedProjectWrapper>
            {project ? (
              <IdBadge
                project={project}
                avatarSize={20}
                displayName={project.slug}
                avatarProps={{consistentWidth: true}}
              />
            ) : (
              t('Deleted')
            )}
            <IconArrow size="xs" direction="right" />
          </MappedProjectWrapper>
          <MappedItemValue>
            {mappedItem ? (
              <React.Fragment>
                <IntegrationIconWrapper>{getIcon(iconType)}</IntegrationIconWrapper>
                {mappedItem.label}
                <StyledExternalLink href={mappedItem.url}>
                  <IconOpen size="xs" />
                </StyledExternalLink>
              </React.Fragment>
            ) : (
              t('Deleted')
            )}
          </MappedItemValue>
          <DeleteButtonWrapper>
            <Button
              onClick={() => handleDelete(index)}
              icon={<IconDelete color="gray500" />}
              size="small"
              type="button"
              aria-label={t('Delete')}
            />
          </DeleteButtonWrapper>
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
          <IntegrationIconWrapper>{getIcon(iconType)}</IntegrationIconWrapper>
          <OptionLabelWrapper>{mappedValue.label}</OptionLabelWrapper>
        </components.ValueContainer>
      );
    };

    const customOptionMappedValue = optionProps => {
      return (
        <components.Option {...optionProps}>
          <OptionWrapper>
            <IntegrationIconWrapper>{getIcon(iconType)}</IntegrationIconWrapper>
            <OptionLabelWrapper>{optionProps.label}</OptionLabelWrapper>
          </OptionWrapper>
        </components.Option>
      );
    };

    return (
      <React.Fragment>
        {existingValues.map(renderItem)}
        <Item>
          <SelectControl
            placeholder={t('Sentry project\u2026')}
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
          <SelectControl
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
          <AddProjectWrapper>
            <Button
              type="button"
              disabled={!selectedSentryProjectId || !selectedMappedValue}
              size="small"
              priority="primary"
              onClick={handleAdd}
              icon={<IconAdd />}
            />
          </AddProjectWrapper>
          <FieldControlWrapper>
            {formElementId && (
              <div>
                <FormFieldControlState model={model} name={formElementId} />
                {error ? <StyledFieldErrorReason>{error}</StyledFieldErrorReason> : null}
              </div>
            )}
          </FieldControlWrapper>
        </Item>
        {nextUrl && (
          <NextButtonPanelAlert icon={false} type="muted">
            <NextButtonWrapper>
              {nextDescription ?? ''}
              <Button
                type="button"
                size="small"
                priority="primary"
                icon={<IconOpen size="xs" color="white" />}
                href={nextUrl}
              >
                {nextButtonText}
              </Button>
            </NextButtonWrapper>
          </NextButtonPanelAlert>
        )}
      </React.Fragment>
    );
  }
}

const ProjectMapperField = (props: Props) => (
  <StyledInputField
    {...props}
    resetOnError
    inline={false}
    stacked={false}
    hideControlState
    field={(renderProps: RenderProps) => <RenderField {...renderProps} />}
  />
);

export default ProjectMapperField;

const MappedProjectWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-right: ${space(1)};
`;

const Item = styled('div')`
  min-height: 60px;
  padding: ${space(2)};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.borderLight};
  }

  display: grid;
  grid-column-gap: ${space(1)};
  align-items: center;
  grid-template-columns: 2.5fr 2.5fr max-content 30px;
  grid-template-areas: 'sentry-project mapped-value manage-project field-control';
`;

const MappedItemValue = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  align-items: center;
  grid-gap: ${space(1)};
  width: 100%;
`;

const DeleteButtonWrapper = styled('div')`
  grid-area: manage-project;
`;

const IntegrationIconWrapper = styled('span')`
  display: flex;
  align-items: center;
`;

const AddProjectWrapper = styled('div')`
  grid-area: manage-project;
`;

const OptionLabelWrapper = styled('div')`
  margin-left: ${space(0.5)};
`;

const StyledInputField = styled(InputField)`
  padding: 0;
`;

const StyledExternalLink = styled(ExternalLink)`
  display: flex;
`;

const OptionWrapper = styled('div')`
  align-items: center;
  display: flex;
`;

const FieldControlWrapper = styled('div')`
  position: relative;
  grid-area: field-control;
`;

const NextButtonPanelAlert = styled(PanelAlert)`
  align-items: center;
  margin-bottom: -1px;
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
`;

const NextButtonWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-gap: ${space(1)};
  align-items: center;
`;

const StyledFieldErrorReason = styled(FieldErrorReason)``;
