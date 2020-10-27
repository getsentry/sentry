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
import {IconVercel, IconGeneric, IconDelete, IconOpen, IconAdd} from 'app/icons';
import ExternalLink from 'app/components/links/externalLink';
import {t} from 'app/locale';
import {removeAtArrayIndex} from 'app/utils/removeAtArrayIndex';
import {safeGetQsParam} from 'app/utils/integrationUtil';

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
      nextButton: {text: nextButtonText, allowedDomain},
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
          <SentryProjectValue>
            {project ? (
              <StyledIdBadge
                project={project}
                avatarSize={20}
                displayName={project.slug}
                avatarProps={{consistentWidth: true}}
              />
            ) : (
              <ItemValue>{t('Deleted')}</ItemValue>
            )}
          </SentryProjectValue>
          <MappedItemValue>
            {mappedItem ? (
              <React.Fragment>
                <IntegrationIconWrapper>{getIcon(iconType)}</IntegrationIconWrapper>
                <MappedValueLabel>{mappedItem.label}</MappedValueLabel>
                <ExternalLinkWrapper>
                  <StyledExternalLink href={mappedItem.url}>
                    <IconOpen />
                  </StyledExternalLink>
                </ExternalLinkWrapper>
              </React.Fragment>
            ) : (
              t('Deleted')
            )}
          </MappedItemValue>
          <DeleteButtonWrapper>
            <DeleteButton
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
          <StyledProjectSelectControl
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
          <MappedValueSelectControl
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
            <StyledAddProjectButton
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
          {nextUrl && (
            <StyledNextButtonWrapper>
              <StyledNextButton
                type="button"
                size="small"
                priority="default"
                icon={<IconOpen />}
                href={nextUrl}
              >
                {nextButtonText}
              </StyledNextButton>
            </StyledNextButtonWrapper>
          )}
        </Item>
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

const StyledProjectSelectControl = styled(SelectControl)`
  grid-area: sentry-project;
`;

const MappedValueSelectControl = styled(SelectControl)`
  grid-area: mapped-value;
`;

const Item = styled('div')`
  margin: -1px;
  border: 1px solid ${p => p.theme.gray400};
  min-height: 60px;
  padding: ${space(1)};

  display: grid;
  grid-column-gap: ${space(1)};
  align-items: center;
  grid-template-columns: 2.5fr 2.5fr 0.8fr 0.3fr 1.1fr;
  grid-template-areas: 'sentry-project mapped-value add-project field-control right-button';
`;

const ItemValue = styled('div')``;

const MappedItemValue = styled('div')`
  display: flex;
  grid-area: mapped-value;
  width: 100%;
`;

const SentryProjectValue = styled('div')`
  grid-area: sentry-project;
`;

const DeleteButtonWrapper = styled('div')`
  grid-area: right-button;
`;

const DeleteButton = styled(Button)`
  float: right;
`;

const StyledIdBadge = styled(IdBadge)``;

const IntegrationIconWrapper = styled('span')`
  display: flex;
  align-items: center;
`;

const AddProjectWrapper = styled('div')`
  grid-area: add-project;
`;

const OptionLabelWrapper = styled('div')`
  margin-left: ${space(0.5)};
`;

const StyledAddProjectButton = styled(Button)`
  float: right;
`;

const StyledNextButtonWrapper = styled('div')`
  grid-area: right-button;
`;

const StyledNextButton = styled(Button)`
  grid-area: right-button;
`;

const StyledInputField = styled(InputField)`
  padding: 0;
`;

const ExternalLinkWrapper = styled('div')`
  height: 100%;
  display: flex;
  align-items: center;
  margin-left: ${space(0.5)};
`;

const StyledExternalLink = styled(ExternalLink)``;

const MappedValueLabel = styled('span')`
  margin-left: ${space(0.5)};
`;

const OptionWrapper = styled('div')`
  align-items: center;
  display: flex;
`;

const FieldControlWrapper = styled('div')`
  position: relative;
  grid-area: field-control;
`;

const StyledFieldErrorReason = styled(FieldErrorReason)``;
