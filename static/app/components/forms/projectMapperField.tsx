import {Component, Fragment} from 'react';
import {components} from 'react-select';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import FieldErrorReason from 'sentry/components/forms/field/fieldErrorReason';
import FormFieldControlState from 'sentry/components/forms/formField/controlState';
import InputField from 'sentry/components/forms/inputField';
import FormModel from 'sentry/components/forms/model';
import SelectControl from 'sentry/components/forms/selectControl';
import {ProjectMapperType} from 'sentry/components/forms/type';
import IdBadge from 'sentry/components/idBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import {PanelAlert} from 'sentry/components/panels';
import {
  IconAdd,
  IconArrow,
  IconDelete,
  IconGeneric,
  IconOpen,
  IconVercel,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {safeGetQsParam} from 'sentry/utils/integrationUtil';
import {removeAtArrayIndex} from 'sentry/utils/removeAtArrayIndex';

type MappedValue = string | number;

type Props = InputField['props'];
type RenderProps = Props & ProjectMapperType & {model: FormModel};

type State = {
  selectedMappedValue: MappedValue | null;
  selectedSentryProjectId: number | null;
};

// Get the icon
const getIcon = (iconType: string) => {
  switch (iconType) {
    case 'vercel':
      return <IconVercel />;
    default:
      return <IconGeneric />;
  }
};

export class RenderField extends Component<RenderProps, State> {
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

    // build sets of values used so we don't let the user select them twice
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
      // add the new value to the list of existing values
      const projectMappings = [
        ...existingValues,
        [selectedSentryProjectId, selectedMappedValue],
      ];
      // trigger events so we save the value and show the check mark
      onChange?.(projectMappings, []);
      onBlur?.(projectMappings, []);
      this.setState({selectedSentryProjectId: null, selectedMappedValue: null});
    };

    const handleDelete = (index: number) => {
      const projectMappings = removeAtArrayIndex(existingValues, index);
      // trigger events so we save the value and show the check mark
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
              <Fragment>
                <IntegrationIconWrapper>{getIcon(iconType)}</IntegrationIconWrapper>
                {mappedItem.label}
                <StyledExternalLink href={mappedItem.url}>
                  <IconOpen size="xs" />
                </StyledExternalLink>
              </Fragment>
            ) : (
              t('Deleted')
            )}
          </MappedItemValue>
          <DeleteButtonWrapper>
            <Button
              onClick={() => handleDelete(index)}
              icon={<IconDelete color="gray300" />}
              size="small"
              type="button"
              aria-label={t('Delete')}
            />
          </DeleteButtonWrapper>
        </Item>
      );
    };

    const customValueContainer = containerProps => {
      // if no value set, we want to return the default component that is rendered
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
            disableLink
          />
        </components.ValueContainer>
      );
    };

    const customOptionProject = projectProps => {
      const project = sentryProjectsById[projectProps.value];
      // Should never happen for a dropdown item
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
            disableLink
          />
        </components.Option>
      );
    };

    const customMappedValueContainer = containerProps => {
      // if no value set, we want to return the default component that is rendered
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
      <Fragment>
        {existingValues.map(renderItem)}
        <Item>
          <SelectControl
            placeholder={t('Sentry project\u2026')}
            name="project"
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
              aria-label={t('Add project')}
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
      </Fragment>
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
    border-bottom: 1px solid ${p => p.theme.innerBorder};
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
  gap: ${space(1)};
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
  gap: ${space(1)};
  align-items: center;
`;

const StyledFieldErrorReason = styled(FieldErrorReason)``;
